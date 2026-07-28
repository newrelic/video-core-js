import Core from "../core";
import Constants from "../constants";
import Chrono from "../chrono";
import Log from "../log";
import Emitter from "../emitter";
import Tracker from "../tracker";
import VideoTracker from "../videotracker";
import VideoTrackerState from "../videotrackerstate";
import { NrVideoEventAggregator } from "../eventAggregator";
import ConnectedDeviceHarvester from "./connectedDeviceHarvester";
import { connectedDeviceAnalyticsHarvester } from "./connectedDeviceAgent";
import { getRegisteredHarvester } from "../recordEvent";
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
  ConnectedDeviceHarvester,
  connectedDeviceAnalyticsHarvester,
  getRegisteredHarvester,
  recordEvent,
  version,
};

export default nrvideo;
