import { videoAnalyticsHarvester } from "./agent.js";
import Constants from "./constants.js";
import Log from "./log.js";

/**
 * Record a video event. Validates the event type, enriches with timestamps,
 * and adds to the harvesting buffer.
 *
 * QoE aggregate events are NOT created here — they are produced at harvest
 * time by the QoE provider registered with the HarvestScheduler.
 *
 * @param {string} eventType - Type of event to record
 * @param {object} attributes - Event attributes
 */
export function recordEvent(eventType, attributes = {}) {
  try {
    // Validate event type
    if (!Constants.VALID_EVENT_TYPES.includes(eventType)) {
      Log.warn("Invalid event type provided to recordEvent", { eventType });
      return false;
    }

    if (!window?.NRVIDEO?.info) return;

    const { appName, applicationID } = window.NRVIDEO.info;

    const eventObject = {
      ...attributes,
      eventType,
      ...(applicationID ? {} : { appName }),
      timestamp: Date.now(),
      timeSinceLoad: window.performance
        ? window.performance.now() / 1000
        : null,
    };

    return videoAnalyticsHarvester.addEvent(eventObject);
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}
