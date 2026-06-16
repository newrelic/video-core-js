import ConnectedDeviceHarvester from "./connectedDeviceHarvester";
import Log from "../log";
import { registerHarvester } from "../recordEvent";

/**
 * Vega-side analytics agent. Mirror of `VideoAnalyticsAgent` in `agent.js`.
 *
 * Wraps a `ConnectedDeviceHarvester` instance and defers its construction until the
 * first `addEvent` call — at which point it reads `info` from
 * `globalThis.__NRVIDEO_CD__` (populated synchronously by `setVideoConfig`
 * during `Core.addTracker`).
 *
 * The exported `connectedDeviceAnalyticsHarvester` singleton is what `recordEvent.js`
 * imports and dispatches to when `att.src === 'Vega'`.
 *
 * Implements REQ-CO-7 from vega-spec.md.
 */
class ConnectedDeviceAnalyticsAgent {
  constructor() {
    // REQ-CO-7 (a): inert flags only — no I/O, no timers, no global writes.
    this.isInitialized = false;
    this.harvester = null;
  }

  /**
   * Lazy initialization. Reads `info` from `globalThis.__NRVIDEO_CD__` and
   * constructs the wrapped `ConnectedDeviceHarvester`. If `info` is not yet populated,
   * returns without flipping `isInitialized` so the next `addEvent` retries.
   *
   * REQ-CO-7 (b)
   */
  initialize() {
    if (this.isInitialized) return;

    const info = globalThis.__NRVIDEO_CD__?.info;
    if (!info) {
      Log.warn(
        "ConnectedDeviceAnalyticsAgent.initialize: globalThis.__NRVIDEO_CD__.info is missing"
      );
      return;
    }

    try {
      this.harvester = new ConnectedDeviceHarvester(info);
      this.isInitialized = true;
      Log.notice("ConnectedDeviceAnalyticsAgent initialized");
    } catch (err) {
      Log.error("ConnectedDeviceAnalyticsAgent.initialize failed:", err.message);
    }
  }

  /**
   * Buffers an event for the wrapped ConnectedDeviceHarvester. Triggers lazy init on
   * the first call. Drops events silently if init has not yet succeeded
   * (defensive — under normal flow, `setVideoConfig` runs synchronously
   * inside `super()` before any player event can fire).
   *
   * REQ-CO-7 (c)
   *
   * @param {object} eventObject
   * @returns {boolean}
   */
  addEvent(eventObject) {
    if (!this.isInitialized) this.initialize();
    if (!this.isInitialized) return false;
    return this.harvester.addEvent(eventObject);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. No-op if not yet initialized.
   * @see ConnectedDeviceHarvester#forceQoeNextHarvest
   */
  forceQoeNextHarvest() {
    if (this.harvester) this.harvester.forceQoeNextHarvest();
  }

  /**
   * API-parity alias for `forceQoeNextHarvest`. Lets `videotracker.js` call a
   * single method name on whichever harvester `getHarvester()` returns —
   * Browser exposes `forceNextQoeCycle`, Vega exposes both names.
   */
  forceNextQoeCycle() {
    this.forceQoeNextHarvest();
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. No-op if not yet initialized.
   * @see ConnectedDeviceHarvester#setBeforeDrainCallback
   * @param {Function|null} cb
   */
  setBeforeDrainCallback(cb) {
    if (this.harvester) this.harvester.setBeforeDrainCallback(cb);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. Triggers lazy init so
   * `videotracker.js`'s drain callback (registered in sendStart) can refresh
   * QoE on the buffered event before send. (REQ-parity with browser.)
   *
   * @param {object} freshKpis
   * @param {string} [viewId]
   */
  refreshQoeKpis(freshKpis, viewId) {
    if (!this.isInitialized) this.initialize();
    if (this.harvester) this.harvester.refreshQoeKpis(freshKpis, viewId);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. Triggers lazy init so
   * `tracker.setHarvestInterval(...)` works for VegaTracker the same way it
   * does for Html5Tracker.
   *
   * @param {number} interval
   */
  setHarvestInterval(interval) {
    if (!this.isInitialized) this.initialize();
    if (this.harvester) this.harvester.setHarvestInterval(interval);
  }
}

// REQ-CO-7 (d): module-level singleton, enforced by ES module identity.
const connectedDeviceAnalyticsAgent = new ConnectedDeviceAnalyticsAgent();

// Self-register for the 'Vega' routing key. Importing this module is what
// makes the Vega pipeline reachable in the consumer's bundle. If no consumer
// imports this module (e.g., Html5Tracker-only build), the entire Vega chain
// — connectedDeviceHarvester, connectedDeviceConstants, and indirectly
// retryQueueHandler/optimizedHttpClient — is tree-shaken.
registerHarvester("Vega", connectedDeviceAnalyticsAgent);

export const connectedDeviceAnalyticsHarvester = connectedDeviceAnalyticsAgent;
