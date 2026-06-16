import Constants from "./constants.js";
import Log from "./log.js";
import Tracker from "./tracker";
import { getObjectEntriesForKeys } from "./utils";

/**
 * Registry-based recordEvent (split build).
 *
 * No static harvester imports. Each harvester self-registers under a key
 * (`'Browser'` or `'Vega'`) at module load time via `registerHarvester`.
 *
 * For Html5Tracker-only builds, only `agent.js` is statically reachable from
 * the import graph; `connectedDeviceAgent.js` and the rest of the Vega chain
 * are unreachable and tree-shaken.
 */
const harvesters = Object.create(null);

/**
 * Register a harvester implementation under a routing key.
 * Called by `agent.js` (key `'Browser'`) and `connectedDeviceAgent.js`
 * (key `'Vega'`) at module load time.
 *
 * @param {string} key  Routing key matching `attributes.src`.
 * @param {{ addEvent: function }} harvester
 */
export function registerHarvester(key, harvester) {
  harvesters[key] = harvester;
}

/**
 * Look up a harvester registered under a routing key. Returns `undefined` if
 * no module has registered for that key in this build (e.g. on the `/browser`
 * subpath, the 'Vega' key is never registered because `connectedDeviceAgent.js`
 * is unreachable from that entry's import graph).
 *
 * Trackers use this getter — instead of importing the harvester binding by
 * name — so the same `tracker.js` / `vegaTracker.js` source files compile
 * unchanged across all three core entry points (main, /browser, /vega) when
 * the html5 webpack build aliases `@newrelic/video-core` to a specific
 * subpath. Without this, parent-class file `tracker.js` would carry an
 * unconditional `import { videoAnalyticsHarvester }` that fails to resolve
 * against the `/vega` subpath.
 *
 * @param {string} key
 * @returns {{ addEvent: function }|undefined}
 */
export function getRegisteredHarvester(key) {
  return harvesters[key];
}

export function recordEvent(eventType, attributes = {}) {
  try {
    if (!Constants.VALID_EVENT_TYPES.includes(eventType)) {
      Log.warn("Invalid event type provided to recordEvent", { eventType });
      return false;
    }

    const isVega = attributes.src === "Vega";
    const routingKey = isVega ? "Vega" : "Browser";

    const info = isVega
      ? globalThis.__NRVIDEO_CD__?.info
      : window?.NRVIDEO?.info;

    if (!info) return;

    const { appName, applicationID } = info;

    const { qoe, ...eventAttributes } = attributes;
    const qoeAttrs = qoe ? { ...qoe } : {};

    const otherAttrs = {
      ...(applicationID ? {} : { appName }),
      timestamp: Date.now(),
      ...(isVega
        ? {}
        : { timeSinceLoad: window.performance ? window.performance.now() / 1000 : null }),
    };

    const eventObject = {
      ...eventAttributes,
      eventType,
      ...otherAttrs,
    };

    const metadataAttributes = getObjectEntriesForKeys(Constants.QOE_AGGREGATE_KEYS, attributes);

    let qoeEventObject = null;
    if (eventType === "VideoAction") {
      qoeEventObject = {
        eventType: "VideoAction",
        actionName: Tracker.Events.QOE_AGGREGATE,
        qoeAggregateVersion: '1.0.0',
        ...qoeAttrs,
        ...metadataAttributes,
        ...otherAttrs,
      };
    }

    const harvester = harvesters[routingKey];
    if (!harvester) {
      Log.warn("No harvester registered for routing key", { routingKey });
      return false;
    }

    const success = harvester.addEvent(eventObject);

    const qoeEnabled = isVega
      ? globalThis.__NRVIDEO_CD__?.config?.qoeAggregate
      : window?.NRVIDEO?.config?.qoeAggregate;

    if (qoeEventObject && qoeEnabled) {
      const successQoe = harvester.addEvent(qoeEventObject);
      return success && successQoe;
    }

    return success;
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}
