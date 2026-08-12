import pkg from "../package.json";
import Emitter from "./emitter";
import Chrono from "./chrono";
import Constants from "./constants";
import Log from "./log";
import { Harvester } from "./utils/eventBuilder";

export interface TrackerOptions {
  heartbeat?: number;
  customData?: Record<string, any>;
  parentTracker?: Tracker;
}

/**
 * Tracker class provides the basic logic to extend Newrelic's Browser Agent capabilities.
 * Trackers are designed to listen third party elements (like video tags, banners, etc.) and send
 * information over to Browser Agent. Extend this class to create your own tracker, override
 * registerListeners and unregisterListeners for full coverage!
 *
 * @example
 * Tracker instances should be added to Core library to start sending data:
 * nrvideo.Core.addTracker(new Tracker())
 *
 * @extends Emitter
 */
class Tracker extends Emitter {
  static Events: Record<string, string>;

  customData: Record<string, any>;
  heartbeat: number | null;
  parentTracker: Tracker | null;
  /**
   * Set externally by subclasses (VideoTracker, which assigns a real
   * VideoTrackerState instance) / tests (which assign plain `{ _isAd }`
   * objects) before any method that reads `this.state._isAd` is invoked.
   * Not initialized in the base constructor. Loosely typed (`any`) since
   * both shapes need to be assignable here without a circular import of
   * VideoTrackerState into the base Tracker.
   */
  state?: any;
  _trackerReadyChrono: Chrono;
  _actionTable: any;
  _actionAdTable: any;
  _heartbeatInterval?: ReturnType<typeof setInterval>;

  /**
   * Constructor, receives options. You should call {@see registerListeners} after this.
   *
   * @param {Object} [options] Options for the tracker. See {@link setOptions}.
   */
  constructor(options?: TrackerOptions) {
    super();

    /**
     * If you add something to this custom dictionary it will be added to every action. If you set
     * any value, it will always override the values returned by the getters.
     *
     * @example
     * If you define tracker.customData.contentTitle = 'a' and tracker.getTitle() returns 'b'.
     * 'a' will prevail.
     */
    this.customData = {};

    /**
     * Set time between hearbeats, in ms.
     */
    this.heartbeat = null;

    /**
     * Another Tracker instance. Useful to relate ad Trackers to their parent content Trackers.
     * @type Tracker
     */
    this.parentTracker = null;

    /**
     * Chrono that counts time since this class was instantiated.
     * @private
     */
    this._trackerReadyChrono = new Chrono();
    this._trackerReadyChrono.start();

    /**
     * Store the initial table of actions with time 0 ms
     */
    this._actionTable = (Constants as any).ACTION_TABLE;
    this._actionAdTable = (Constants as any).ACTION_AD_TABLE;

    options = options || {};
    this.setOptions(options);
  }

  /**
   * Set options for the Tracker.
   *
   * @param {Object} [options] Options for the tracker.
   * @param {number} [options.heartbeat] Set time between heartbeats. See {@link heartbeat}.
   * @param {Object} [options.customData] Set custom data. See {@link customData}.
   * @param {Tracker} [options.parentTracker] Set parent tracker. See {@link parentTracker}.
   */
  setOptions(options?: TrackerOptions): void {
    if (options) {
      if (options.parentTracker) this.parentTracker = options.parentTracker;
      if (options.customData) this.customData = options.customData;
      if (options.heartbeat) this.heartbeat = options.heartbeat;
    }
  }

  /**
   * Prepares tracker to dispose. Calls {@see unregisterListeners} and drops references.
   */
  dispose(): void {
    this.unregisterListeners();
  }

  /**
   * Override this method to register listeners to third party elements.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  registerListeners(): void {}

  /**
   * Override this method to unregister listeners to third party elements created with
   * {@see registerListeners}.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  unregisterListeners() {
   *    this.player.off('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  unregisterListeners(): void {}

  /**
   * Returns heartbeat time interval. 30000 (30s) if not set. See {@link setOptions}.
   * @return {number} Heartbeat interval in ms.
   * @final
   */
  getHeartbeat(): number {
    if (this.state?._isAd) {
      // modifying heartbeat for Ad Tracker
      return 2000;
    } else {
      if (this.heartbeat) {
        return this.heartbeat;
      } else if (this.parentTracker && this.parentTracker.heartbeat) {
        return this.parentTracker.heartbeat;
      } else {
        return 30000;
      }
    }
  }

  /**
   * Starts heartbeating. Interval period set by options.heartbeat. Min 2000 ms.
   * This method is automaticaly called by the tracker once sendRequest is called.
   */
  startHeartbeat(): void {
    this._heartbeatInterval = setInterval(
      this.sendHeartbeat.bind(this),
      Math.max(this.getHeartbeat(), 2000)
    );
  }

  /**
   * Stops heartbeating. This method is automaticaly called by the tracker.
   */
  stopHeartbeat(): void {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval);
    }
  }

  /**
   * Heartbeating allows you to call this function each X milliseconds, defined by
   * {@link getHeartbeat}. This is useful to send regular events to track changes.
   *
   * By default it will send {@link Tracker.Events.HEARTBEAT}.
   * To start heartbeating use {@link startHeartbeat} and to stop them use {@link stopHeartbeat}.
   *
   * @example
   * Override this method to define your own Heartbeat reporting.
   *
   * class TrackerChild extends Tracker {
   *  sendHeartbeat (att) {
   *    this.send('MY_HEARBEAT_EVENT')
   *  }
   * }
   *
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendHeartbeat(att?: Record<string, any>): void {
    this.sendVideoAction(Tracker.Events.HEARTBEAT, att);
  }

  /**
   * Override this method to return attributes for actions.
   *
   * @example
   * class SpecificTracker extends Tracker {
   *  getAttributes(att) {
   *    att = att || {}
   *    att.information = 'something'
   *    return att
   *  }
   * }
   *
   * @param {object} [att] Collection of key value attributes
   * @return {object} Filled attributes
   * @final
   */
  getAttributes(att?: Record<string, any>, eventType?: string): Record<string, any> {
    att = att || {};
    att.trackerName = this.getTrackerName();
    att.trackerVersion = this.getTrackerVersion();
    att.coreVersion = pkg.version;
    att.timeSinceTrackerReady = this._trackerReadyChrono.getDeltaTime();

    for (let key in this.customData) {
      att[key] = this.customData[key];
    }

    if (document.hidden != undefined) {
      att.isBackgroundEvent = document.hidden;
    }

    return att;
  }

  /** Override to change of the Version of tracker. ie: '1.0.1' */
  getTrackerVersion(): string {
    return pkg.version;
  }

  /** Override to change of the Name of the tracker. ie: 'custom-html5' */
  getTrackerName(): string {
    return "base-tracker";
  }

  /**
   * Send given event. Will automatically call {@see getAttributes} to fill information.
   * Internally, this will call {@see Emitter#emit}, so you could listen any event fired.
   *
   * @example
   * tracker.sendVideoAction('BANNER_CLICK', { url: 'http....' })
   *
   * @param {string} event Event name
   * @param {object} [att] Key:value dictionary filled with attributes.
   */

  sendVideoAction(event: string, att?: Record<string, any>): void {
    this.emit("VideoAction", event, this.getAttributes(att));
  }

  sendVideoAdAction(event: string, att?: Record<string, any>): void {
    this.emit("VideoAdAction", event, this.getAttributes(att));
  }

  sendVideoErrorAction(event: string, att?: Record<string, any>): void {
    let ev = (this as any).isAd() ? "adError" : "videoError";
    this.emit("VideoErrorAction", event, this.getAttributes(att, ev));
  }

  sendVideoCustomAction(event: string, att?: Record<string, any>): void {
    this.emit(
      "VideoCustomAction",
      event,
      this.getAttributes(att, "customAction")
    );
  }

  /**
   * Sets the harvest interval for video tracking.
   * @param {*} interval - The interval in milliseconds.
   * @returns {void}
   */

  setHarvestInterval(interval: number): void {
    const harvester = this.getHarvester?.();
    if (!harvester) {
      Log.error("Tracker has no harvester; setHarvestInterval ignored");
      return;
    }

    try {
      harvester.setHarvestInterval?.(interval);
    } catch (error: any) {
      Log.error("Failed to set harvest interval:", error.message);
      return;
    }
  }

  /**
   * Default harvester accessor. Subclasses (Html5Tracker, VegaTracker, etc.)
   * override this to point to their specific harvester. Returning `null` here
   * means a tracker that doesn't override `getHarvester()` will silently no-op
   * on harvester-bound calls (setHarvestInterval, QoE drain wiring).
   */
  getHarvester(): Harvester | null {
    return null;
  }

  // Note: base Tracker has no `isAd` member at all (matching original JS —
  // calling sendVideoErrorAction on a bare Tracker throws the native "not a
  // function" error). VideoTracker defines its own `isAd()`; the one call
  // site above (sendVideoErrorAction) casts to `any` rather than declaring
  // an `isAd` member here, since TS treats a `declare`d property and a real
  // subclass method as incompatible override kinds (TS2425).
}

/**
 * Enumeration of events fired by this class.
 *
 * @static
 * @memberof Tracker
 * @enum {string}
 */
Tracker.Events = {
  /** The heartbeat event is sent once every 30 seconds while the video is playing. */
  HEARTBEAT: "HEARTBEAT",
  QOE_AGGREGATE: "QOE_AGGREGATE",
};

export default Tracker;
