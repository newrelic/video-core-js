import { NrVideoEventAggregator } from "../eventAggregator";
import {
  MOBILE_ENDPOINT,
  STAGING_MOBILE_ENDPOINT,
  NR_ENDPOINT,
  DEFAULT_HARVEST_TIME,
  DEFAULT_BUFFER_SIZE,
  CD_DATA_TOKENS_PAYLOAD,
  CD_DEVICE_INFO,
  CD_METADATA,
} from "../constants";
import {
  bufferEventWithQoeDedup,
  refreshQoeKpisInBuffer,
  partitionByQoeCycle,
  applyQoeDirtyFilter,
} from "../utils/qoeFilters";
import { createHarvestTimer } from "../utils/harvestTimer";
import Log from "../log";

/**
 * Generic NR mobile-collector harvester implementing the CAF protocol
 * (`/v5/connect` + `/v3/data`). Wire format mirrors `@newrelic/video-caf-js@3.1.0`.
 *
 * The class is **not Vega-specific** — it owns the HTTP client, dataToken,
 * harvest setInterval, and event buffer for any consumer that needs to ship
 * to NR's mobile collector. Vega-specific routing/lifecycle is provided by
 * the wrapper `ConnectedDeviceAnalyticsAgent` in `connectedDeviceAgent.js` (REQ-CO-7).
 *
 * Implements REQ-CDH-1..26 from vega-spec.md.
 *
 * Constraints (REQ-CDH-20):
 *   - No `document`, `window.location`, `navigator.sendBeacon`, `localStorage`.
 *   - No DOM event listener registration (no `pagehide`/`visibilitychange`).
 *   - `globalThis` is allowed (platform-neutral global, not a DOM API).
 *
 * Note: QoE config (qoeIntervalFactor) is currently read from the Vega-specific
 * `globalThis.__NRVIDEO_CD__.config` slot — REQ-CDH-22 ties this read site to
 * the Vega global by design. Future refactors may inject this via constructor
 * for full Vega-decoupling.
 */
export default class ConnectedDeviceHarvester {
  /**
   * @param {object} opts
   * @param {string} [opts.accountId]         Captured for parity with CAF; not transmitted.
   * @param {string} opts.applicationToken    Sent as `X-App-License-Key` header. (REQ-CDH-2)
   * @param {string} opts.endpoint            One of `US`, `EU`, `staging`. (REQ-CDH-3)
   * @param {number} [opts.harvestInterval]   Send cadence in ms. Defaults to 60s.
   * @param {number} [opts.maxBufferSize]     Buffer cap before forced send. Defaults to 100.
   * @param {object} [opts.deviceInfo]        Customer-collected device identity. Any of:
   *   uuid, osVersion, deviceModel, deviceManufacturer, osBuild, appBuild, architecture.
   *   Each field optional — missing values fall back to placeholders from
   *   `connectedDeviceConstants.js`. Extra fields are ignored. The customer is
   *   expected to source these from a platform device-info library (e.g.
   *   `@amazon-devices/react-native-device-info` on Kepler) and pass the
   *   resulting object once at construction. `osBuild` is the OS image build
   *   (e.g., `getBuildIdSync()`); `appBuild` is the consumer app's build
   *   number (e.g., `getBuildNumber()`).
   */
  constructor({
    accountId,
    applicationToken,
    endpoint,
    harvestInterval,
    maxBufferSize,
    deviceInfo,
  } = {}) {
    if (!applicationToken) {
      throw new Error("applicationToken is required"); // REQ-CDH-2
    }
    if (!Object.values(NR_ENDPOINT).includes(endpoint)) {
      throw new Error("Invalid endpoint"); // REQ-CDH-3
    }

    this.accountId = accountId;
    this.applicationToken = applicationToken;
    this.endpoint = endpoint;
    this.harvestInterval = harvestInterval ?? DEFAULT_HARVEST_TIME;
    this.maxBufferSize = maxBufferSize ?? DEFAULT_BUFFER_SIZE;

    // Destructure customer-supplied device identity. Each field optional;
    // unset / empty values silently fall back to the static defaults in
    // CD_DEVICE_INFO / CD_METADATA. Extra fields the customer passes (e.g.
    // a wider device-info object from their own internal model) are ignored.
    const {
      uuid,
      osVersion,
      deviceModel,
      deviceManufacturer,
      osBuild,
      appBuild,
      architecture,
    } = deviceInfo ?? {};
    this.deviceInfo = {
      uuid:               uuid               || CD_DEVICE_INFO[5],          // slot [5] = deviceUuid placeholder
      osVersion:          osVersion          || CD_DEVICE_INFO[1],
      deviceModel:        deviceModel        || CD_DEVICE_INFO[2],
      deviceManufacturer: deviceManufacturer || CD_DEVICE_INFO[8],
      osBuild:            osBuild            || CD_METADATA.osBuild,
      appBuild:           appBuild           || CD_METADATA.appBuild,
      architecture:       architecture       || CD_METADATA.architecture,
    };

    this.eventBuffer = new NrVideoEventAggregator(); // REQ-CDH-4

    // Smart-harvest wiring: buffer triggers an early drain at 60% (smart) and
    // 90% (overflow) capacity, before makeRoom()'s drop-oldest FIFO eviction
    // would silently lose events. Structural mirror of HarvestScheduler:29 on
    // the Browser side — same `setSmartHarvestCallback` shape, named method
    // for stack-trace clarity and unit-testability.
    this.eventBuffer.setSmartHarvestCallback((type, threshold) =>
      this.triggerSmartHarvest(type, threshold)
    );

    this.dataToken = null; // REQ-CDH-5
    this.isHarvesting = false;
    this.isDisposed = false;

    // Periodic harvest timer. Chained-setTimeout under the hood (see
    // `utils/harvestTimer.js`) — guarantees no overlapping ticks even if the
    // drain takes longer than the interval. Shared with the Browser pipeline.
    this.timer = createHarvestTimer({
      interval: this.harvestInterval,
      onTick: () => this.sendBufferedEvents(),
      errorLabel: "ConnectedDeviceHarvester",
    });

    // QoE state (REQ-CDH-22..25)
    this.qoeCycleCount = 1;
    this.forceQoeNextCycle = false;
    this.beforeDrainCallback = null;
    this._lastSentQoeKpis = {};

    // Connect retry state (REQ-CDH-10..11)
    this._connectAttempt = 0;
    this._connectExhausted = false;

    // REQ-CDH-6: fire-and-forget initialise.
    this.initialise();
  }

  /**
   * Returns the base URL for the configured endpoint. (REQ-CDH-19)
   * @returns {string}
   */
  getEndpointBaseUrl() {
    return this.endpoint === NR_ENDPOINT.STAGING
      ? STAGING_MOBILE_ENDPOINT
      : MOBILE_ENDPOINT;
  }

  /**
   * Two-phase init: fetch dataToken, then start harvest interval. (REQ-CDH-7)
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
   * up to 10 attempts (1s, 2s, 4s, ... doubling). (REQ-CDH-8..11)
   * @param {number} attempt
   * @returns {Promise<void>}
   */
  async fetchDataTokens(attempt = 0) {
    const url = `${this.getEndpointBaseUrl()}/v5/connect`;
    const requestBody = JSON.stringify(CD_DATA_TOKENS_PAYLOAD);
    try {
      Log.notice(`ConnectedDeviceHarvester: POST ${url}`);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-App-License-Key": this.applicationToken,
        },
        body: requestBody,
      });

      if (!res.ok) {
        // Drain response body so we can surface the collector's rejection
        // reason. Mobile collector returns plain-text or empty `{}` on 4xx.
        let errBody = "";
        try {
          errBody = await res.text();
        } catch (_) {
          /* ignore */
        }
        throw new Error(`HTTP ${res.status} body=${errBody}`);
      }

      const body = await res.json();
      if (!body || !body.data_token) {
        throw new Error("Missing data_token in connect response");
      }
      this.dataToken = body.data_token; // REQ-CDH-9
      this._connectAttempt = 0;
      Log.notice("ConnectedDeviceHarvester: dataToken acquired");
    } catch (err) {
      this._connectAttempt = attempt + 1;
      Log.error(
        `ConnectedDeviceHarvester: /v5/connect failed (attempt ${this._connectAttempt}/10):`,
        err.message
      );

      if (this._connectAttempt >= 10) {
        // REQ-CDH-11
        this._connectExhausted = true;
        Log.error("ConnectedDeviceHarvester: Max retries reached");
        return;
      }

      // REQ-CDH-10: exponential backoff starting at 1s, doubling each attempt.
      const delay = 1000 * 2 ** attempt;
      await new Promise((resolve) => setTimeout(resolve, delay));
      return this.fetchDataTokens(this._connectAttempt);
    }
  }

  /**
   * Starts the periodic harvest timer. (REQ-CDH-12)
   * Idempotent — safe to call repeatedly.
   */
  startHarvestInterval() {
    if (this.isDisposed) return;
    this.timer.start();
  }

  /**
   * Smart-harvest handler. Invoked by `NrVideoEventAggregator` when the buffer
   * crosses 60% (`type='smart'`) or 90% (`type='overflow'`) of capacity, before
   * `makeRoom()` would start FIFO-evicting events. Drains the buffer immediately.
   *
   * Structural mirror of `HarvestScheduler.triggerSmartHarvest` on the Browser
   * side. Vega doesn't need timer cancel/reschedule because `setInterval` is
   * autonomous and the `isHarvesting` flag inside `sendBufferedEvents` already
   * prevents a periodic tick from racing with this call.
   *
   * @param {'smart'|'overflow'} type
   * @param {number} threshold - The threshold percentage that triggered the harvest (60 or 90).
   * @returns {Promise<void>}
   */
  async triggerSmartHarvest(type, threshold) {
    Log.notice(
      `ConnectedDeviceHarvester: smart-harvest trigger (${type} at ${threshold}%)`
    );
    if (!this.eventBuffer || this.eventBuffer.isEmpty()) return;
    try {
      await this.sendBufferedEvents();
    } catch (error) {
      Log.error(`${type} smart-harvest failed:`, error.message);
    } finally {
      // Reset the periodic clock — next periodic tick happens `harvestInterval`
      // after this smart drain, not from the originally-scheduled time.
      this.timer.cancelAndReschedule();
    }
  }

  /**
   * Buffers an event for the next harvest cycle.
   *
   * QOE_AGGREGATE events are deduplicated by (actionName + viewId) per
   * REQ-CDH-21 — mirror of `agent.js:52-63`. Other events are appended with
   * a `timestamp` field per REQ-CDH-13.
   *
   * @param {object} eventObject
   * @returns {boolean}
   */
  addEvent(eventObject) {
    try {
      // REQ-CDH-21 — shared QOE_AGGREGATE dedup + non-QoE append. Timestamp
      // is preserved from `recordEvent.js` (emit-time), matching the Browser
      // pipeline. Cross-pipeline analytics produce consistent timestamps.
      return bufferEventWithQoeDedup(this.eventBuffer, eventObject);
    } catch (err) {
      Log.error("ConnectedDeviceHarvester.addEvent failed:", err.message);
      return false;
    }
  }

  /**
   * Forces the next harvest cycle to ship QOE_AGGREGATE regardless of cycle
   * multiplier or dirty check. Used at CONTENT_END for final QoE flush. (REQ-CDH-24)
   */
  forceQoeNextHarvest() {
    this.forceQoeNextCycle = true;
  }

  /**
   * Registers a callback invoked at the start of every send cycle, before
   * the buffer is drained. Lets the tracker refresh QoE KPIs in the buffer
   * before they ship. (REQ-CDH-25)
   * @param {Function|null} cb
   */
  setBeforeDrainCallback(cb) {
    if (typeof cb === "function" || cb === null) {
      this.beforeDrainCallback = cb;
    }
  }

  /**
   * Updates QoE KPI fields on the existing QOE_AGGREGATE event in the buffer.
   * Mirror of `VideoAnalyticsAgent#refreshQoeKpis` (`agent.js`) so VegaTracker's
   * QoE drain wiring can route here through `getHarvester()`.
   *
   * @param {object} freshKpis - Object with latest KPI values
   * @param {string} [viewId] - The viewId of the player whose QoE event to update
   */
  refreshQoeKpis(freshKpis, viewId) {
    refreshQoeKpisInBuffer(this.eventBuffer, freshKpis, viewId);
  }

  /**
   * Updates the harvest cadence at runtime. If the periodic timer is already
   * running, it is cleared and restarted with the new interval. Mirror of
   * `VideoAnalyticsAgent#setHarvestInterval` (`agent.js`).
   *
   * @param {number} interval - New cadence in ms.
   */
  setHarvestInterval(interval) {
    if (typeof interval !== "number" || interval <= 0) return;
    this.harvestInterval = interval;
    this.timer.updateInterval(interval);
  }

  /**
   * Drains the buffer and POSTs to `/v3/data`. Applies the QoE cycle filter
   * and cross-cycle dirty check before send.
   *
   * Mirror of `harvestScheduler.js` drain + send logic, adapted for the CAF
   * 10-tuple wire format and plain `fetch` transport.
   *
   * REQ-CDH-14..17, REQ-CDH-22..23
   *
   * @returns {Promise<void>}
   */
  async sendBufferedEvents() {
    // REQ-CDH-14: guard rails
    if (this.isHarvesting) return;
    if (!this.dataToken) return;
    if (this.eventBuffer.isEmpty()) return;

    // REQ-CDH-25: refresh QoE KPIs before drain.
    if (typeof this.beforeDrainCallback === "function") {
      try {
        this.beforeDrainCallback();
      } catch (e) {
        Log.error("ConnectedDeviceHarvester beforeDrainCallback failed:", e.message);
      }
    }

    this.isHarvesting = true;
    const drained = this.eventBuffer.drain();

    // REQ-CDH-22: QoE cycle filter (mirror of harvestScheduler.js:251-287)
    const multiplier =
      globalThis.__NRVIDEO_CD__?.config?.qoeIntervalFactor ?? 1;
    const isForced = this.forceQoeNextCycle;
    const isQoeCycle =
      (this.qoeCycleCount - 1) % multiplier === 0 || isForced;
    if (this.forceQoeNextCycle) this.forceQoeNextCycle = false;

    const filtered = partitionByQoeCycle(drained, isQoeCycle, this.eventBuffer);
    this.qoeCycleCount++;

    // REQ-CDH-23: cross-cycle dirty check
    applyQoeDirtyFilter(filtered, this._lastSentQoeKpis, isForced);

    if (filtered.length === 0) {
      this.isHarvesting = false;
      return;
    }

    const url = `${this.getEndpointBaseUrl()}/v3/data`;
    const headers = {
      "Content-Type": "application/json",
      "X-App-License-Key": this.applicationToken,
    };
    // Build 10-tuple body per spec §7.2. Wrapped so REQ-CDH-26 retry can
    // rebuild with a refreshed dataToken in slot [0]. Slots [1] and [8] are
    // built from this.deviceInfo (customer-supplied where present, defaults
    // from CD_DEVICE_INFO / CD_METADATA otherwise).
    const buildBody = () =>
      JSON.stringify([
        this.dataToken, // [0] from /v5/connect
        this._buildDeviceInfo(), // [1] device tuple
        0, // [2] reserved
        [], // [3] reserved
        [], // [4] reserved
        [], // [5] reserved
        [], // [6] reserved
        [], // [7] reserved
        this._buildMetadata(), // [8] session metadata
        filtered, // [9] events
      ]);

    try {
      let res = await fetch(url, {
        method: "POST",
        headers,
        body: buildBody(),
      });

      // REQ-CDH-26: dataToken expiry handling. Mobile collector returns 401
      // when the dataToken issued by /v5/connect is no longer accepted
      // (e.g., after server-side rotation or session timeout). Refresh once
      // and retry the same drained payload before falling through to the
      // re-queue path.
      if (res.status === 401) {
        Log.notice(
          "ConnectedDeviceHarvester: /v3/data returned 401, refreshing dataToken"
        );
        this.dataToken = null;
        // Reset connect retry counters so the refresh starts a fresh
        // 10-attempt budget independent of the original startup attempt.
        this._connectAttempt = 0;
        this._connectExhausted = false;
        await this.fetchDataTokens();
        if (!this.dataToken) {
          throw new Error(
            "Failed to refresh dataToken after 401 on /v3/data"
          );
        }
        res = await fetch(url, {
          method: "POST",
          headers,
          body: buildBody(),
        });
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      Log.notice(`ConnectedDeviceHarvester: sent ${filtered.length} events`); // REQ-CDH-16
    } catch (err) {
      Log.error("ConnectedDeviceHarvester: /v3/data send failed:", err.message);
      // REQ-CDH-17: re-queue drained events into buffer; next tick retries.
      for (const e of filtered) this.eventBuffer.add(e);
    } finally {
      this.isHarvesting = false;
    }
  }

  /**
   * Build slot [1] of /v3/data — the 10-element device-info tuple. Customer-
   * supplied fields override the static defaults from CD_DEVICE_INFO; missing
   * or empty fields fall through to the placeholders that ship in
   * connectedDeviceConstants.js.
   * @returns {Array}
   * @private
   */
  _buildDeviceInfo() {
    const d = this.deviceInfo;
    return [
      CD_DEVICE_INFO[0],          // osName        — fixed ("Vega")
      d.osVersion,                // [1] osVersion
      d.deviceModel,              // [2] deviceModel
      CD_DEVICE_INFO[3],          // agentName     — fixed ("VegaAgent")
      CD_DEVICE_INFO[4],          // agentVersion  — fixed
      d.uuid,                     // [5] deviceUuid
      "",                         // [6] reserved
      "",                         // [7] reserved
      d.deviceManufacturer,       // [8] manufacturer
      CD_DEVICE_INFO[9],          // [9] sizeMeta  — fixed
    ];
  }

  /**
   * Build slot [8] of /v3/data — the session-metadata object. Spreads the
   * static `CD_METADATA` defaults (`osName`, `platform`, `appBuild`) and
   * overrides only `osBuild` and `architecture` from the customer-supplied
   * deviceInfo. Device-identity fields (osVersion, deviceModel,
   * deviceManufacturer, osMajorVersion, platformVersion) live in slot [1]
   * (`CD_DEVICE_INFO`) and are intentionally not duplicated here.
   * @returns {object}
   * @private
   */
  _buildMetadata() {
    const d = this.deviceInfo;
    return {
      ...CD_METADATA,
      osBuild:      d.osBuild,
      appBuild:     d.appBuild,
      architecture: d.architecture,
    };
  }

  /**
   * Stops the harvest interval and attempts one final best-effort send. (REQ-CDH-18)
   * @returns {Promise<void>}
   */
  async dispose() {
    this.isDisposed = true;
    this.timer.stop();
    return this.sendBufferedEvents();
  }
}
