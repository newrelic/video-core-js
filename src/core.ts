import Log from "./log";
import { recordEvent } from "./recordEvent";
import { setVideoConfig, RawVideoConfigInfo, RawVideoConfigOptions } from "./videoConfiguration";
import Emitter from "./emitter";

/** Structural contract Core needs from anything passed to addTracker/removeTracker. */
export interface TrackerLike extends Emitter {
  dispose(): void;
  trackerInit?(): void;
}

export interface CoreAddTrackerOptions {
  info?: RawVideoConfigInfo;
  config?: RawVideoConfigOptions;
  src?: string;
}

/**
 * Static class that sums up core functionalities of the library.
 * @static
 */
class Core {
  /**
   * Add a tracker to the system. Trackers added will start reporting its events to the video analytics backend.
   *
   * @param {(Emitter|Tracker)} tracker Tracker instance to add.
   * @param {object} options Configuration options including video analytics settings.
   */
  static addTracker(tracker: TrackerLike, options?: CoreAddTrackerOptions): void {
    // Set video analytics configuration. The optional `options.src` field
    // selects the pipeline: `'Vega'` writes globalThis.__NRVIDEO_CD__,
    // anything else writes window.NRVIDEO.
    if (options?.info) {
      setVideoConfig(options.info, options?.config, options?.src);
    }

    if (tracker.on && tracker.emit) {
      trackers.push(tracker);
      tracker.on("*", eventHandler);
      if (typeof tracker.trackerInit == "function") {
        tracker.trackerInit();
      }
    } else {
      Log.error("Tried to load a non-tracker.", tracker);
    }
  }

  /**
   * Disposes and remove given tracker. Removes its listeners.
   *
   * @param {Tracker} tracker Tracker to remove.
   */
  static removeTracker(tracker: TrackerLike): void {
    tracker.off("*", eventHandler);
    tracker.dispose();
    let index = trackers.indexOf(tracker);
    if (index !== -1) trackers.splice(index, 1);
  }

  /**
   * Returns the array of trackers.
   *
   * @returns {Tracker[]} Array of trackers.
   */
  static getTrackers(): TrackerLike[] {
    return trackers;
  }

  /**
   * Enhanced send method with performance timing.
   * @param {string} eventType - Type of event
   * @param {string} actionName - Action name
   * @param {object} data - Event data
   */
  static send(eventType: string, actionName: string, data?: Record<string, any>): boolean | undefined {
    const enrichedData = {
      actionName,
      ...data,

    };

    return recordEvent(eventType, enrichedData);
  }

  /**
   * Sends an error event.
   * This may be used for external errors launched by the app, the network or
   * any external factor. Note that errors within the player are normally reported with
   * tracker.sendError, so this method should not be used to report those.
   *
   * @param {object} att attributes to be sent along the error.
   */
  static sendError(att?: Record<string, any>): boolean | undefined {
    return recordEvent("VideoErrorAction", {
      actionName: "ERROR",
      ...att
    });
  }

}

let trackers: TrackerLike[] = [];
let isErrorShown: boolean = false;

/**
 * Enhanced event handler with error handling and performance monitoring.
 *
 * @private
 * @param {Event} e Event
 */
function eventHandler(e: any) {
  try {
    let data = cleanData(e.data);

    if ((Log.level as any) <= Log.Levels.DEBUG) {
      Log.notice("Sent", e.type, data);
    } else {
      Log.notice("Sent", e.type);
    }

    // Send event without priority discrimination
    Core.send(e.eventType, e.type, data);

  } catch (error: any) {
    Log.error("Error in event handler:", error.message);
  }
}

/**
 * Cleans given object, removing all items with value === null.
 * @private
 * @param {Object} data Data to clean
 * @returns {Object} Cleaned object
 */
function cleanData(data: Record<string, any>): Record<string, any> {
  let ret: Record<string, any> = {};
  for (let i in data) {
    if (data[i] !== null && typeof data[i] !== "undefined") ret[i] = data[i];
  }
  return ret;
}

export default Core;
