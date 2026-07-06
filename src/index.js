import Core from "./core";
import Constants from "./constants";
import Chrono from "./chrono";
import Log from "./log";
import Emitter from "./emitter";
import Tracker from "./tracker";
import VideoTracker from "./videotracker";
import VideoTrackerState from "./videotrackerstate";
import { NrVideoEventAggregator } from "./eventAggregator";
import { RetryQueueHandler } from "./retryQueueHandler";
import { OptimizedHttpClient } from "./optimizedHttpClient";
import { HarvestScheduler } from "./browser/harvestScheduler";
import { recordEvent, getRegisteredHarvester } from "./recordEvent";
import { version } from "../package.json";

// Harvesters are exported as NAMED exports only — never added to the `nrvideo`
// default-namespace object. This is the load-bearing detail for tree-shaking

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

export { videoAnalyticsHarvester } from "./browser/agent";
export { connectedDeviceAnalyticsHarvester } from "./connectedDevice/connectedDeviceAgent";
export { getRegisteredHarvester } from "./recordEvent";

export default nrvideo;
