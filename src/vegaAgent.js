import MobileHarvester from "./mobileHarvester";
import Log from "./log";

/**
 * Vega-side analytics agent. Mirror of `VideoAnalyticsAgent` in `agent.js`.
 *
 * Wraps a `MobileHarvester` instance and defers its construction until the
 * first `addEvent` call — at which point it reads `info` from
 * `globalThis.__NRVIDEO_VEGA__` (populated synchronously by `setVideoConfig`
 * during `Core.addTracker`).
 *
 * The exported `vegaAnalyticsHarvester` singleton is what `recordEvent.js`
 * imports and dispatches to when `att.src === 'Vega'`.
 *
 * Implements REQ-CO-7 from vega-spec.md.
 */
class VegaAnalyticsAgent {
  constructor() {
    // REQ-CO-7 (a): inert flags only — no I/O, no timers, no global writes.
    this.isInitialized = false;
    this.harvester = null;
  }

  /**
   * Lazy initialization. Reads `info` from `globalThis.__NRVIDEO_VEGA__` and
   * constructs the wrapped `MobileHarvester`. If `info` is not yet populated,
   * returns without flipping `isInitialized` so the next `addEvent` retries.
   *
   * REQ-CO-7 (b)
   */
  initialize() {
    if (this.isInitialized) return;

    const info = globalThis.__NRVIDEO_VEGA__?.info;
    if (!info) {
      Log.warn(
        "VegaAnalyticsAgent.initialize: globalThis.__NRVIDEO_VEGA__.info is missing"
      );
      return;
    }

    try {
      this.harvester = new MobileHarvester(info);
      this.isInitialized = true;
      Log.notice("VegaAnalyticsAgent initialized");
    } catch (err) {
      Log.error("VegaAnalyticsAgent.initialize failed:", err.message);
    }
  }

  /**
   * Buffers an event for the wrapped MobileHarvester. Triggers lazy init on
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
   * Forwards to the underlying MobileHarvester. No-op if not yet initialized.
   * @see MobileHarvester#forceQoeNextHarvest
   */
  forceQoeNextHarvest() {
    if (this.harvester) this.harvester.forceQoeNextHarvest();
  }

  /**
   * Forwards to the underlying MobileHarvester. No-op if not yet initialized.
   * @see MobileHarvester#setBeforeDrainCallback
   * @param {Function|null} cb
   */
  setBeforeDrainCallback(cb) {
    if (this.harvester) this.harvester.setBeforeDrainCallback(cb);
  }
}

// REQ-CO-7 (d): module-level singleton, enforced by ES module identity.
const vegaAnalyticsAgent = new VegaAnalyticsAgent();

export const vegaAnalyticsHarvester = vegaAnalyticsAgent;
