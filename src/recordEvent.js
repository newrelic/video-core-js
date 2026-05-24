import { videoAnalyticsHarvester } from "./agent.js";
import { vegaAnalyticsHarvester } from "./vegaAgent.js";
import Constants from "./constants.js";
import Log from "./log.js";
import Tracker from "./tracker";
import {getObjectEntriesForKeys} from "./utils";

/**
 * Enhanced record event function with validation, enrichment, and unified handling.
 *
 * Routes by per-event `attributes.src`:
 *   - `'Vega'`    -> vegaAnalyticsHarvester  (mobile collector)
 *   - anything else -> videoAnalyticsHarvester (browser collector)
 *
 * Both harvesters are module-level singletons; routing is a direct dispatch
 * via the imported reference. The two pipelines have parallel info/config
 * stores: `globalThis.__NRVIDEO_VEGA__.{info,config}` for Vega vs
 * `window.NRVIDEO.{info,config}` for browser. (REQ-CO-3)
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

    // (a) Per-event discriminator
    const isVega = attributes.src === "Vega";

    // (b) Pick info source from the right global
    const info = isVega
      ? globalThis.__NRVIDEO_VEGA__?.info
      : window?.NRVIDEO?.info;

    // (c) Single gate covers both pipelines
    if (!info) return;

    const { appName, applicationID } = info;

    const { qoe, ...eventAttributes } = attributes;
    const qoeAttrs = qoe ? { ...qoe } : {};

    const otherAttrs = {
        // appName/applicationID enrichment is identical for both pipelines.
        ...(applicationID ? {} : { appName }), // Only include appName when no applicationID
        timestamp: Date.now(),
        // (d) NR-only enrichment skipped on Vega path (no window.performance there).
        ...(isVega
            ? {}
            : { timeSinceLoad: window.performance ? window.performance.now() / 1000 : null }),
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
            qoeAggregateVersion: '1.0.0',
            ...qoeAttrs,
            ...metadataAttributes,
            ...otherAttrs,
        }
    }

    // (e) Pick destination harvester via direct module import — no global-slot
    // lookup for the harvester reference. (REQ-CO-3 part e, mirror of agent.js)
    const harvester = isVega ? vegaAnalyticsHarvester : videoAnalyticsHarvester;
    const success = harvester.addEvent(eventObject);

    // (f) QoE gate read from the right global.
    const qoeEnabled = isVega
      ? globalThis.__NRVIDEO_VEGA__?.config?.qoeAggregate
      : window?.NRVIDEO?.config?.qoeAggregate;

    if(qoeEventObject && qoeEnabled) {
        const successQoe = harvester.addEvent(qoeEventObject);
        return success && successQoe;
    }

    return success;
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}
