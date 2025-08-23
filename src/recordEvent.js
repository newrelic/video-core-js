import { videoAnalyticsHarvester } from "./agent.js";
import Constants from "./constants.js";
import Log from "./log.js";

/**
 * Enhanced record event function with validation, enrichment, and unified handling.
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

    // Get app configuration

    if (!window?.NRVIDEO?.info) return;

    const { appName, applicationID } = window.NRVIDEO.info;

    const eventObject = {
      ...attributes,
      eventType,
      ...(applicationID ? {} : { appName }), // Only include appName when no applicationID
      timestamp: Date.now(),
      timeSinceLoad: window.performance
        ? window.performance.now() / 1000
        : null,
    };

    // Send to video analytics harvester
    const success = videoAnalyticsHarvester.addEvent(eventObject);
    return success;
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}
