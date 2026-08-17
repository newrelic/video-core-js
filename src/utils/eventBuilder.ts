import Constants from "../constants";
import Tracker from "../tracker";
import { getObjectEntriesForKeys } from "./index";

export type EventAttributes = Record<string, any>;

export interface Harvester {
  addEvent(eventObject: EventAttributes): boolean;
  setHarvestInterval(ms: number): void;
  /** Set (or clear, with `null`) the callback run just before the next harvest drain. */
  setBeforeDrainCallback(callback: (() => void) | null): void;
  /** Merge fresh QoE KPI values into the buffered QOE_AGGREGATE event for a view. */
  refreshQoeKpis(freshKpis: EventAttributes, viewId?: string): void;
  /** Force the next harvest cycle to be treated as a QoE cycle. Only the browser harvester supports this — the connected-device harvester does not implement it. */
  forceNextQoeCycle?(): void;
}

interface BuildEventObjectsOptions {
  addTimeSinceLoad?: boolean;
}

/**
 * Pure helper that constructs the wire-format event objects from `recordEvent`
 * arguments. Used by `src/recordEvent.js`, which is the single shared
 * implementation re-exported from all three subpath entry points:
 *
 *   - `src/recordEvent.js`                (registry dispatcher; runtime hot path
 *                                          and the only direct caller of this helper)
 *   - `src/browser/index.js`              (Browser subpath re-export)
 *   - `src/connectedDevice/index.js`      (Vega subpath re-export)
 *
 * Pipeline-specific concerns (which info global to read, which harvester to
 * call, which qoeAggregate config to check) stay at the call site. This helper
 * is purely about event-object shape.
 *
 * @param {string} eventType - One of `Constants.VALID_EVENT_TYPES`.
 * @param {object} attributes - Caller-supplied attributes including optional `qoe`.
 * @param {object} info - The pipeline's resolved `info` object (with `appName` /
 *   `applicationID` for namespacing).
 * @param {{ addTimeSinceLoad?: boolean }} [opts] - When `true`, stamp
 *   `timeSinceLoad` on the event. Browser sets this; Vega does not.
 *
 * @returns {{ eventObject: object, qoeEventObject: object|null }}
 */
export function buildEventObjects(
  eventType: string,
  attributes: EventAttributes,
  info: Record<string, any>,
  { addTimeSinceLoad = false }: BuildEventObjectsOptions = {}
): { eventObject: EventAttributes; qoeEventObject: EventAttributes | null } {
  const { appName, applicationID } = info;
  const { qoe, ...eventAttributes } = attributes;
  const qoeAttrs = qoe ? { ...qoe } : {};

  const otherAttrs = {
    ...(applicationID ? {} : { appName }),
    timestamp: Date.now(),
    ...(addTimeSinceLoad
      ? {
          timeSinceLoad:
            typeof window !== "undefined" && window.performance
              ? window.performance.now() / 1000
              : null,
        }
      : {}),
  };

  const eventObject = {
    ...eventAttributes,
    eventType,
    ...otherAttrs,
  };

  let qoeEventObject: EventAttributes | null = null;
  if (eventType === "VideoAction") {
    const metadataAttributes = getObjectEntriesForKeys(
      Constants.QOE_AGGREGATE_KEYS,
      attributes
    );
    qoeEventObject = {
      eventType: "VideoAction",
      actionName: Tracker.Events.QOE_AGGREGATE,
      qoeAggregateVersion: "1.0.0",
      ...qoeAttrs,
      ...metadataAttributes,
      ...otherAttrs,
    };
  }

  return { eventObject, qoeEventObject };
}

/**
 * Build + dispatch a video analytics event to the given harvester.
 *
 * This is the full dispatch loop shared by all three `recordEvent` entry
 * points:
 *   1. Build `eventObject` (and optional `qoeEventObject`) via
 *      `buildEventObjects`.
 *   2. Call `harvester.addEvent(eventObject)`.
 *   3. If qoeEnabled and a QoE companion event was produced, also call
 *      `harvester.addEvent(qoeEventObject)`.
 *   4. Return a boolean indicating overall success.
 *
 * Pipeline-specific concerns — which global to read for `info`, which
 * harvester to use, whether qoeAggregate is on — are resolved by the caller.
 * This function only handles the build + dispatch.
 *
 * @param {string} eventType
 * @param {object} attributes
 * @param {object} info - Resolved `info` from the pipeline's config global.
 * @param {{ addEvent: function }} harvester - The registered harvester for
 *   the current pipeline. Returns false if null/undefined.
 * @param {boolean} qoeEnabled
 * @param {{ addTimeSinceLoad?: boolean }} [opts] - Forwarded to
 *   `buildEventObjects`.
 * @returns {boolean}
 */
export function dispatchRecordEvent(
  eventType: string,
  attributes: EventAttributes,
  info: Record<string, any>,
  harvester: Harvester | null | undefined,
  qoeEnabled: boolean,
  { addTimeSinceLoad = false }: BuildEventObjectsOptions = {}
): boolean {
  if (!harvester) return false;

  const { eventObject, qoeEventObject } = buildEventObjects(
    eventType,
    attributes,
    info,
    { addTimeSinceLoad }
  );

  const success = harvester.addEvent(eventObject);

  if (qoeEventObject && qoeEnabled) {
    return success && harvester.addEvent(qoeEventObject);
  }

  return success;
}
