import Log from "./log";
import Backend from "./backend";
import EventBuffer from "./EventBuffer";
import Constants from "./constants";

const { trackerEventHarvestInterval, playerEventHarvestInterval } = Constants;

let originTime = null; // Used to calculate the origin time of events.
/**
 * Static class that sums up core functionalities of the library.
 * @static
 */
class Core {
  // seperate instance for tracker and player events
  static trackerEventBufferInstance = new EventBuffer(
    trackerEventHarvestInterval
  );
  //  static playerEventBufferInstance = new EventBuffer(playerEventHarvestInterval);

  /**
   * Calculates and returns the "origin time" for the current Browse session.
   * The origin time is the timestamp (in milliseconds since the Unix epoch)
   * at which the current document's lifetime began, or approximately when the
   * page started loading.
   *
   * It prioritizes `Date.now() - window.performance.now()` for higher precision,
   * falling back to `Date.now()` if `window.performance.now()` is not available.
   *
   * @returns {number} The origin time in milliseconds.
   */

  static _getOriginTime() {
    if (originTime === null) {
      if (window.performance && typeof Date.now === "function") {
        originTime = Date.now() - window.performance.now();
      } else {
        originTime = Date.now(); // Fallback
        Log.warn(
          "Core: window.performance.now() not available for precise originTime. Using Date.now()."
        );
      }
    }
    return originTime;
  }

  /**
   * Add a tracker to the system. Trackers added will start reporting its events to NR's backend.
   *
   * @param {(Emitter|Tracker)} tracker Tracker instance to add.
   */

  static addTracker(tracker) {
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

  static removeTracker(tracker) {
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

  static getTrackers() {
    return trackers;
  }

  /**
   * Returns the current backend.
   *
   * @returns {Backend} The current backend.
   */

  static getBackend() {
    return backend;
  }

  /**
   * Sets the current backend.
   * @param {Backend} backendInstance Backend instance.
   */
  static setBackend(backendInstance) {
    backend = backendInstance;
  }

  /**
   * Dispatches an event to the appropriate internal buffer for tracking.
   * If the origin time hasn't been established yet, it calculates and sets it
   * for both the tracker and player event buffers.
   * Events with the `actionName` "CONTENT_HEARTBEAT" are routed to the
   * tracker event buffer, while all other events go to the player event buffer.
   *
   * @param {string} eventType The type of event (e.g., "MediaPlayer").
   * @param {string} actionName The specific action associated with the event (e.g., "play", "pause", "CONTENT_HEARTBEAT").
   * @param {object} data Additional data to be included with the event.
   */

  static send(eventType, actionName, data) {
    console.log("actionName", actionName);
    if (originTime === null) {
      originTime = Core._getOriginTime();
      Core.trackerEventBufferInstance.setOriginTime(originTime);
      // Core.playerEventBufferInstance.setOriginTime(originTime);
    }
    if (actionName === "CONTENT_HEARTBEAT") {
      Core.trackerEventBufferInstance.addEvent(eventType, {
        actionName,
        ...data,
      });
    }
    // else{
    //   Core.playerEventBufferInstance.addEvent(eventType, { actionName, ...data });
    //  }
  }

  /**
   * Sends an error event. This may be used for external errors launched by the app, the network or
   * any external factor. Note that errors within the player are normally reported with
   * tracker.sendError, so this method should not be used to report those.
   *
   * @param {object} att attributes to be sent along the error.
   */
  static sendError(att) {
    Core.send("ERROR", att);
  }
}

let trackers = [];
let backend;
let isErrorShown = false;

/**
 * Logs and sends given event.
 *
 * @private
 * @param {Event} e Event
 */
function eventHandler(e) {
  let data = cleanData(e.data);
  if (Log.level <= Log.Levels.DEBUG) {
    Log.notice("Sent", e.type, data);
  } else {
    Log.notice("Sent", e.type);
  }

  Core.send(e.eventType, e.type, data);
}

/**
 * Cleans given object, removing all items with value === null.
 * @private
 * @param {Object} data Data to clean
 * @returns {Object} Cleaned object
 */
function cleanData(data) {
  let ret = {};
  for (let i in data) {
    if (data[i] !== null && typeof data[i] !== "undefined") ret[i] = data[i];
  }
  return ret;
}

export default Core;
