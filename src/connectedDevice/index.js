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
import { getObjectEntriesForKeys } from "../utils";
import ConnectedDeviceHarvester from "./connectedDeviceHarvester";
import { connectedDeviceAnalyticsHarvester } from "./connectedDeviceAgent";
import { getRegisteredHarvester } from "../recordEvent";
import { version } from "../../package.json";

/**
 * Vega entry recordEvent. Dispatches directly to the Vega harvester
 * — no registry lookup, no Browser branch, no window.NRVIDEO read.
 * Browser-only modules (agent.js, harvestScheduler.js) are unreachable
 * from this entry's import graph and are tree-shaken.
 */
export function recordEvent(eventType, attributes = {}) {
  try {
    if (!Constants.VALID_EVENT_TYPES.includes(eventType)) {
      Log.warn("Invalid event type provided to recordEvent", { eventType });
      return false;
    }

    const info = globalThis?.__NRVIDEO_CD__?.info;
    if (!info) return;

    const { appName, applicationID } = info;
    const { qoe, ...eventAttributes } = attributes;
    const qoeAttrs = qoe ? { ...qoe } : {};

    const otherAttrs = {
      ...(applicationID ? {} : { appName }),
      timestamp: Date.now(),
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

    const success = connectedDeviceAnalyticsHarvester.addEvent(eventObject);

    const qoeEnabled = globalThis?.__NRVIDEO_CD__?.config?.qoeAggregate;

    if (qoeEventObject && qoeEnabled) {
      const successQoe =
        connectedDeviceAnalyticsHarvester.addEvent(qoeEventObject);
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

  ConnectedDeviceHarvester,
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
  ConnectedDeviceHarvester,
  connectedDeviceAnalyticsHarvester,
  getRegisteredHarvester,
  version,
};

export default nrvideo;
