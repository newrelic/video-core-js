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
import { HarvestScheduler } from "./harvestScheduler";
import { recordEvent } from "./recordEvent";
import { version } from "../package.json";

const nrvideo = {
  // Core components (existing)
  Constants,
  Chrono,
  Log,
  Emitter,
  Tracker,
  VideoTracker,
  VideoTrackerState,
  Core,
  version,

  // Enhanced video analytics components (new)
 
  NrVideoEventAggregator,
  RetryQueueHandler,
  OptimizedHttpClient,
  HarvestScheduler,



  // Enhanced event recording
  recordEvent,


};

export default nrvideo;
