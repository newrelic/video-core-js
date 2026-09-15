import ConnectedDeviceHarvester from "./connectedDeviceHarvester";
import Log from "../log";
import { registerHarvester } from "../recordEvent";
import { EventAttributes, Harvester } from "../utils/eventBuilder";

/**
 * Vega-side analytics agent. Mirror of `VideoAnalyticsAgent` in `agent.js`.
 */
class ConnectedDeviceAnalyticsAgent implements Harvester {
  isInitialized: boolean;
  harvester: ConnectedDeviceHarvester | null;

  constructor() {
    this.isInitialized = false;
    this.harvester = null;
  }

  /**
   * Lazy initialization. Reads `info` from `globalThis.__NRVIDEO_CD__` and
   * constructs the wrapped `ConnectedDeviceHarvester`. If `info` is not yet populated,
   * returns without flipping `isInitialized` so the next `addEvent` retries.
   */
  initialize(): void {
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
    } catch (err: any) {
      Log.error("ConnectedDeviceAnalyticsAgent.initialize failed:", err.message);
    }
  }

  /**
   * Buffers an event for the wrapped ConnectedDeviceHarvester. Triggers lazy init on
   * the first call. Drops events silently if init has not yet succeeded
   * (defensive — under normal flow, `setVideoConfig` runs synchronously
   * inside `super()` before any player event can fire).
   *
   *
   * @param {object} eventObject
   * @returns {boolean}
   */
  addEvent(eventObject: EventAttributes): boolean {
    if (!this.isInitialized) this.initialize();
    if (!this.isInitialized) return false;
    return (this.harvester as ConnectedDeviceHarvester).addEvent(eventObject);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. No-op if not yet initialized.
   * @see ConnectedDeviceHarvester#forceQoeNextHarvest
   */
  forceQoeNextHarvest(): void {
    if (this.harvester) this.harvester.forceQoeNextHarvest();
  }

  /**
   * API-parity alias for `forceQoeNextHarvest`. Lets `videotracker.js` call a
   * single method name on whichever harvester `getHarvester()` returns —
   * Browser exposes `forceNextQoeCycle`, Vega exposes both names.
   */
  forceNextQoeCycle(): void {
    this.forceQoeNextHarvest();
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. No-op if not yet initialized.
   * @see ConnectedDeviceHarvester#setBeforeDrainCallback
   * @param {Function|null} cb
   */
  setBeforeDrainCallback(cb: (() => void) | null): void {
    if (this.harvester) this.harvester.setBeforeDrainCallback(cb);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. Triggers lazy init so
   * `videotracker.js`'s drain callback (registered in sendStart) can refresh
   * QoE on the buffered event before send.
   *
   * @param {object} freshKpis
   * @param {string} [viewId]
   */
  refreshQoeKpis(freshKpis: EventAttributes, viewId?: string): void {
    if (!this.isInitialized) this.initialize();
    if (this.harvester) this.harvester.refreshQoeKpis(freshKpis, viewId);
  }

  /**
   * Forwards to the underlying ConnectedDeviceHarvester. Triggers lazy init so
   * `tracker.setHarvestInterval(...)` works for VegaTracker the same way it
   * does for other trackers.
   *
   * @param {number} interval
   */
  setHarvestInterval(interval: number): void {
    if (!this.isInitialized) this.initialize();
    if (this.harvester) this.harvester.setHarvestInterval(interval);
  }
}

const connectedDeviceAnalyticsAgent = new ConnectedDeviceAnalyticsAgent();

// Self-register for the 'Vega' routing key. Importing this module is what
// makes the Vega pipeline reachable in the consumer's bundle. If no consumer
// imports this module (e.g., Html5Tracker-only build), the entire Vega chain
// — connectedDeviceHarvester, connectedDeviceConstants, and indirectly
// retryQueueHandler/optimizedHttpClient — is tree-shaken.
registerHarvester("Vega", connectedDeviceAnalyticsAgent);

export const connectedDeviceAnalyticsHarvester = connectedDeviceAnalyticsAgent;
