import Core from "../core";
import Constants from "../constants";
import Chrono from "../chrono";
import Log from "../log";
import Emitter from "../emitter";
import Tracker from "../tracker";
import VideoTracker from "../videotracker";
import VideoTrackerState from "../videotrackerstate";
import { NrVideoEventAggregator } from "../eventAggregator";
import { RetryQueueHandler } from "../retryQueueHandler";
import { OptimizedHttpClient } from "../optimizedHttpClient";
import { HarvestScheduler } from "./harvestScheduler";
import { getObjectEntriesForKeys } from "../utils";
import { videoAnalyticsHarvester } from "./agent";
import { getRegisteredHarvester } from "../recordEvent";
import { version } from "../../package.json";

/**
 * Browser entry recordEvent. Dispatches directly to the browser harvester
 * — no registry lookup, no Vega branch, no globalThis.__NRVIDEO_CD__ read.
 * Vega-only modules (connectedDeviceAgent, connectedDeviceHarvester,
 * connectedDeviceConstants) are unreachable from this entry's import graph
 * and are tree-shaken.
 */
export function recordEvent(eventType, attributes = {}) {
  try {
    if (!Constants.VALID_EVENT_TYPES.includes(eventType)) {
      Log.warn("Invalid event type provided to recordEvent", { eventType });
      return false;
    }

    const info = typeof window !== "undefined" ? window?.NRVIDEO?.info : undefined;
    if (!info) return;

    const { appName, applicationID } = info;
    const { qoe, ...eventAttributes } = attributes;
    const qoeAttrs = qoe ? { ...qoe } : {};

    const otherAttrs = {
      ...(applicationID ? {} : { appName }),
      timestamp: Date.now(),
      timeSinceLoad:
        typeof window !== "undefined" && window.performance
          ? window.performance.now() / 1000
          : null,
    };

    const eventObject = { ...eventAttributes, eventType, ...otherAttrs };

    const metadataAttributes = getObjectEntriesForKeys(
      Constants.QOE_AGGREGATE_KEYS,
      attributes
    );

    let qoeEventObject = null;
    if (eventType === "VideoAction") {
      qoeEventObject = {
        eventType: "VideoAction",
        actionName: Tracker.Events.QOE_AGGREGATE,
        qoeAggregateVersion: "1.0.0",
        ...qoeAttrs,
        ...metadataAttributes,
        ...otherAttrs,
      };
    }

    const success = videoAnalyticsHarvester.addEvent(eventObject);

    const qoeEnabled =
      typeof window !== "undefined" && window?.NRVIDEO?.config?.qoeAggregate;

    if (qoeEventObject && qoeEnabled) {
      const successQoe = videoAnalyticsHarvester.addEvent(qoeEventObject);
      return success && successQoe;
    }

    return success;
  } catch (error) {
    Log.error("Failed to record event:", error.message);
    return false;
  }
}

const nrvideo = {
  Constants,
  Chrono,
  Log,
  Emitter,
  Tracker,
  VideoTracker,
  VideoTrackerState,
  Core,
  version,

  NrVideoEventAggregator,
  RetryQueueHandler,
  OptimizedHttpClient,
  HarvestScheduler,

  recordEvent,
};

export {
  Core,
  Constants,
  Chrono,
  Log,
  Emitter,
  Tracker,
  VideoTracker,
  VideoTrackerState,
  NrVideoEventAggregator,
  RetryQueueHandler,
  OptimizedHttpClient,
  HarvestScheduler,
  videoAnalyticsHarvester,
  getRegisteredHarvester,
  version,
};

export default nrvideo;
