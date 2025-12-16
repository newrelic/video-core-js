import { videoAnalyticsHarvester } from "./agent.js";
import Constants from "./constants.js";
import Log from "./log.js";
import Tracker from "./tracker";
import {getObjectEntriesForKeys} from "./utils";

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

    const { qoe, ...eventAttributes } = attributes;
    const qoeAttrs = qoe ? { ...qoe } : {};

    const otherAttrs = {
        ...(applicationID ? {} : { appName }), // Only include appName when no applicationID
        timestamp: Date.now(),
        timeSinceLoad: window.performance
            ? window.performance.now() / 1000
            : null,
    }

    const eventObject = {
      ...eventAttributes,
      eventType,
      ...otherAttrs,
    };

    const metadataAttributes = getObjectEntriesForKeys(Constants.QOE_AGGREGATE_KEYS, attributes)

    let qoeEventObject = null;
    if(eventType === "VideoAction") {
        qoeEventObject = {
            eventType: "VideoAction",
            actionName: Tracker.Events.QOE_AGGREGATE,
            ...qoeAttrs,
            ...metadataAttributes,
            ...otherAttrs,
        }
    }

    // Send to video analytics harvester
    const success = videoAnalyticsHarvester.addEvent(eventObject);

    if(qoeEventObject) {
        const successQoe = videoAnalyticsHarvester.addEvent(qoeEventObject);
        return success && successQoe;
    }

    return success;
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}
