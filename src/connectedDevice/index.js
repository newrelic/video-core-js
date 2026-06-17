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
import ConnectedDeviceHarvester from "./connectedDeviceHarvester";
import { connectedDeviceAnalyticsHarvester } from "./connectedDeviceAgent";
import { getRegisteredHarvester } from "../recordEvent";
// recordEvent is shared with all three subpaths — single definition in
// `src/recordEvent.js` handles both Browser and Vega pipelines via the
// registry and the `attributes.src` routing key.
export { recordEvent } from "../recordEvent";
import { recordEvent } from "../recordEvent";
import { version } from "../../package.json";

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
