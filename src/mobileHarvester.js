import { NrVideoEventAggregator } from "./eventAggregator";
import Constants from "./constants";
import Log from "./log";
import Tracker from "./tracker";
import {
  MOBILE_ENDPOINT,
  STAGING_MOBILE_ENDPOINT,
  NR_ENDPOINT,
  DEFAULT_HARVEST_TIME,
  DEFAULT_BUFFER_SIZE,
  VEGA_DATA_TOKENS_PAYLOAD,
  VEGA_DEVICE_INFO,
  VEGA_METADATA,
} from "./vegaConstants";

/**
 * Generic NR mobile-collector harvester implementing the CAF protocol
 * (`/v5/connect` + `/v3/data`). Wire format mirrors `@newrelic/video-caf-js@3.1.0`.
 *
 * The class is **not Vega-specific** — it owns the HTTP client, dataToken,
 * harvest setInterval, and event buffer for any consumer that needs to ship
 * to NR's mobile collector. Vega-specific routing/lifecycle is provided by
 * the wrapper `VegaAnalyticsAgent` in `vegaAgent.js` (REQ-CO-7).
 *
 * Implements REQ-VH-1..25 from vega-spec.md.
 *
 * Constraints (REQ-VH-20):
 *   - No `document`, `window.location`, `navigator.sendBeacon`, `localStorage`.
 *   - No DOM event listener registration (no `pagehide`/`visibilitychange`).
 *   - `globalThis` is allowed (platform-neutral global, not a DOM API).
 *
 * Note: QoE config (qoeIntervalFactor) is currently read from the Vega-specific
 * `globalThis.__NRVIDEO_VEGA__.config` slot — REQ-VH-22 ties this read site to
 * the Vega global by design. Future refactors may inject this via constructor
 * for full Vega-decoupling.
 */
export default class MobileHarvester {
  /**
   * @param {object} opts
   * @param {string} [opts.accountId]         Captured for parity with CAF; not transmitted.
   * @param {string} opts.applicationToken    Sent as `X-App-License-Key` header. (REQ-VH-2)
   * @param {string} opts.endpoint            One of `US`, `EU`, `staging`. (REQ-VH-3)
   * @param {number} [opts.harvestInterval]   Send cadence in ms. Defaults to 60s.
   * @param {number} [opts.maxBufferSize]     Buffer cap before forced send. Defaults to 100.
   */
  constructor({
    accountId,
    applicationToken,
    endpoint,
    harvestInterval,
    maxBufferSize,
  } = {}) {
    if (!applicationToken) {
      throw new Error("applicationToken is required"); // REQ-VH-2
    }
    if (!Object.values(NR_ENDPOINT).includes(endpoint)) {
      throw new Error("Invalid endpoint"); // REQ-VH-3
    }

    this.accountId = accountId;
    this.applicationToken = applicationToken;
    this.endpoint = endpoint;
    this.harvestInterval = harvestInterval ?? DEFAULT_HARVEST_TIME;
    this.maxBufferSize = maxBufferSize ?? DEFAULT_BUFFER_SIZE;

    this.eventBuffer = new NrVideoEventAggregator(); // REQ-VH-4
    this.dataToken = null; // REQ-VH-5
    this.isHarvesting = false;
    this.intervalId = null;
    this.isDisposed = false;

    // QoE state (REQ-VH-22..25)
    this.qoeCycleCount = 1;
    this.forceQoeNextCycle = false;
    this.beforeDrainCallback = null;
    this._lastSentQoeKpis = {};

    // Connect retry state (REQ-VH-10..11)
    this._connectAttempt = 0;
    this._connectExhausted = false;

    // REQ-VH-6: fire-and-forget initialise.
    this.initialise();
  }

  /**
   * Returns the base URL for the configured endpoint. (REQ-VH-19)
   * @returns {string}
   */
  getEndpointBaseUrl() {
    return this.endpoint === NR_ENDPOINT.STAGING
      ? STAGING_MOBILE_ENDPOINT
      : MOBILE_ENDPOINT;
  }

  /**
   * Two-phase init: fetch dataToken, then start harvest interval. (REQ-VH-7)
   * @returns {Promise<void>}
   */
  async initialise() {
    await this.fetchDataTokens();
    // Defensive guard: if dispose() ran while fetchDataTokens was awaiting,
    // do not start an interval that will outlive the harvester.
    if (this.isDisposed) return;
    if (this.dataToken) {
      this.startHarvestInterval();
    }
  }

  /**
   * POST `/v5/connect` to obtain dataToken, with exponential-backoff retry
   * up to 10 attempts (1s, 2s, 4s, ... doubling). (REQ-VH-8..11)
   * @param {number} attempt
   * @returns {Promise<void>}
   */
  async fetchDataTokens(attempt = 0) {
    const url = `${this.getEndpointBaseUrl()}/v5/connect`;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-License-Key": this.applicationToken,
        },
        body: JSON.stringify(VEGA_DATA_TOKENS_PAYLOAD),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const body = await res.json();
      if (!body || !body.data_token) {
        throw new Error("Missing data_token in connect response");
      }
      this.dataToken = body.data_token; // REQ-VH-9
      this._connectAttempt = 0;
      Log.notice("MobileHarvester: dataToken acquired");
    } catch (err) {
      this._connectAttempt = attempt + 1;
      Log.error(
        `MobileHarvester: /v5/connect failed (attempt ${this._connectAttempt}/10):`,
        err.message
      );

      if (this._connectAttempt >= 10) {
        // REQ-VH-11
        this._connectExhausted = true;
        Log.error("MobileHarvester: Max retries reached");
        return;
      }

      // REQ-VH-10: exponential backoff starting at 1s, doubling each attempt.
      const delay = 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.fetchDataTokens(this._connectAttempt);
    }
  }

  /**
   * Starts the periodic harvest timer. (REQ-VH-12)
   */
  startHarvestInterval() {
    if (this.intervalId || this.isDisposed) return;
    this.intervalId = setInterval(
      () => this.sendBufferedEvents(),
      this.harvestInterval
    );
  }

  /**
   * Buffers an event for the next harvest cycle.
   *
   * QOE_AGGREGATE events are deduplicated by (actionName + viewId) per
   * REQ-VH-21 — mirror of `agent.js:52-63`. Other events are appended with
   * a `timestamp` field per REQ-VH-13.
   *
   * @param {object} eventObject
   * @returns {boolean}
   */
  addEvent(eventObject) {
    if (!eventObject) return false;

    try {
      // REQ-VH-21
      if (eventObject.actionName === Tracker.Events.QOE_AGGREGATE) {
        if (eventObject.viewId) {
          return this.eventBuffer.addOrReplaceByActionNameAndViewId(
            Tracker.Events.QOE_AGGREGATE,
            eventObject.viewId,
            eventObject
          );
        }
        return this.eventBuffer.addOrReplaceByActionName(
          Tracker.Events.QOE_AGGREGATE,
          eventObject
        );
      }

      // REQ-VH-13
      return this.eventBuffer.add({ ...eventObject, timestamp: Date.now() });
    } catch (err) {
      Log.error("MobileHarvester.addEvent failed:", err.message);
      return false;
    }
  }

  /**
   * Forces the next harvest cycle to ship QOE_AGGREGATE regardless of cycle
   * multiplier or dirty check. Used at CONTENT_END for final QoE flush. (REQ-VH-24)
   */
  forceQoeNextHarvest() {
    this.forceQoeNextCycle = true;
  }

  /**
   * Registers a callback invoked at the start of every send cycle, before
   * the buffer is drained. Lets the tracker refresh QoE KPIs in the buffer
   * before they ship. (REQ-VH-25)
   * @param {Function|null} cb
   */
  setBeforeDrainCallback(cb) {
    if (typeof cb === "function" || cb === null) {
      this.beforeDrainCallback = cb;
    }
  }

  /**
   * Drains the buffer and POSTs to `/v3/data`. Applies the QoE cycle filter
   * and cross-cycle dirty check before send.
   *
   * Mirror of `harvestScheduler.js` drain + send logic, adapted for the CAF
   * 10-tuple wire format and plain `fetch` transport.
   *
   * REQ-VH-14..17, REQ-VH-22..23
   *
   * @returns {Promise<void>}
   */
  async sendBufferedEvents() {
    // REQ-VH-14: guard rails
    if (this.isHarvesting) return;
    if (!this.dataToken) return;
    if (this.eventBuffer.isEmpty()) return;

    // REQ-VH-25: refresh QoE KPIs before drain.
    if (typeof this.beforeDrainCallback === "function") {
      try {
        this.beforeDrainCallback();
      } catch (e) {
        Log.error("MobileHarvester beforeDrainCallback failed:", e.message);
      }
    }

    this.isHarvesting = true;
    const drained = this.eventBuffer.drain();

    // REQ-VH-22: QoE cycle filter (mirror of harvestScheduler.js:251-287)
    const multiplier =
      globalThis.__NRVIDEO_VEGA__?.config?.qoeIntervalFactor ?? 1;
    const isForced = this.forceQoeNextCycle;
    const isQoeCycle =
      (this.qoeCycleCount - 1) % multiplier === 0 || isForced;
    if (this.forceQoeNextCycle) this.forceQoeNextCycle = false;

    let filtered;
    if (isQoeCycle) {
      filtered = drained;
    } else {
      // On non-QoE cycles, re-buffer QOE_AGGREGATE events instead of dropping them.
      filtered = [];
      for (const e of drained) {
        if (e.actionName === Tracker.Events.QOE_AGGREGATE) {
          this.eventBuffer.add(e);
        } else {
          filtered.push(e);
        }
      }
    }
    this.qoeCycleCount++;

    // REQ-VH-23: cross-cycle dirty check (mirror of harvestScheduler.js:289-298)
    for (let i = filtered.length - 1; i >= 0; i--) {
      const e = filtered[i];
      if (e.actionName === Tracker.Events.QOE_AGGREGATE) {
        if (!isForced && this._qoeKpisUnchanged(e)) {
          filtered.splice(i, 1);
        } else {
          this._saveQoeKpis(e);
        }
      }
    }

    if (filtered.length === 0) {
      this.isHarvesting = false;
      return;
    }

    // Build 10-tuple body per spec §7.2.
    const body = JSON.stringify([
      this.dataToken, // [0] from /v5/connect
      VEGA_DEVICE_INFO, // [1] device tuple
      0, // [2] reserved
      [], // [3] reserved
      [], // [4] reserved
      [], // [5] reserved
      [], // [6] reserved
      [], // [7] reserved
      VEGA_METADATA, // [8] session metadata
      filtered, // [9] events
    ]);

    try {
      const res = await fetch(`${this.getEndpointBaseUrl()}/v3/data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-License-Key": this.applicationToken,
        },
        body,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Log.notice(`MobileHarvester: sent ${filtered.length} events`); // REQ-VH-16
    } catch (err) {
      Log.error("MobileHarvester: /v3/data send failed:", err.message);
      // REQ-VH-17: re-queue drained events into buffer; next tick retries.
      for (const e of filtered) this.eventBuffer.add(e);
    } finally {
      this.isHarvesting = false;
    }
  }

  /**
   * Stops the harvest interval and attempts one final best-effort send. (REQ-VH-18)
   * @returns {Promise<void>}
   */
  async dispose() {
    this.isDisposed = true;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    return this.sendBufferedEvents();
  }

  /**
   * Checks if QoE KPIs are unchanged since the last successful send.
   * Per-viewId to support multiple players sharing one harvester. (REQ-VH-23)
   * @param {object} event
   * @returns {boolean}
   * @private
   */
  _qoeKpisUnchanged(event) {
    const snapshot = this._lastSentQoeKpis[event.viewId];
    if (!snapshot) return false;
    for (const key of Constants.QOE_KPI_KEYS) {
      if (event[key] !== snapshot[key]) return false;
    }
    return true;
  }

  /**
   * Stores the QoE KPI snapshot for the given event's viewId. (REQ-VH-23)
   * @param {object} event
   * @private
   */
  _saveQoeKpis(event) {
    const snapshot = {};
    for (const key of Constants.QOE_KPI_KEYS) {
      snapshot[key] = event[key];
    }
    this._lastSentQoeKpis[event.viewId] = snapshot;
  }
}
