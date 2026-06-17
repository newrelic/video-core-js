/**
 * Constants for the library.
 * @class Constants
 * @static
 */
class Constants {}

/**
 * Enum for types/positions of ads.
 * @example var type = Constants.AdPositions.PRE
 * @enum {String}
 */
Constants.AdPositions = {
  /** For ads shown before the content. */
  PRE: "pre",
  /** For ads shown during the content. */
  MID: "mid",
  /** For ads shown after the content. */
  POST: "post",
};

// bam.nr-data.net
//bam-cell.nr-data.net

Constants.COLLECTOR = {
  US: ["bam.nr-data.net", "bam-cell.nr-data.net"],
  EU: "bam.eu01.nr-data.net",
  Staging: "staging-bam-cell.nr-data.net",
  GOV: "gov-bam.nr-data.net",
};

// ====== VALID EVENT TYPES ======
Constants.VALID_EVENT_TYPES = [
  "VideoAction",
  "VideoAdAction",
  "VideoErrorAction",
  "VideoCustomAction",
];

Constants.MAX_PAYLOAD_SIZE = 1048576; // 1MB = 1024 × 1024 bytes
Constants.MAX_BEACON_SIZE = 61440; // 60KB = 60 × 1024 bytes
Constants.MAX_EVENTS_PER_BATCH = 1000;
Constants.INTERVAL = 10000; //10 seconds

Constants.QOE_KPI_KEYS = [
    "startupTime", "peakBitrate", "averageBitrate", "totalPlaytime",
    "totalRebufferingTime", "rebufferingRatio", "hadStartupError",
    "hadPlaybackError", "numberOfErrors"
];

Constants.QOE_AGGREGATE_KEYS = [
    "coreVersion", "instrumentation.name",
    "instrumentation.provider", "instrumentation.version", "isBackgroundEvent", "playerName", "playerVersion",
    "src", "viewId", "viewSession", "contentIsAutoplayed", "contentIsMuted", "contentRenditionHeight", "contentRenditionWidth",
    "contentSrc", "numberOfVideos", "pageUrl", "trackerName", "trackerVersion", "contentDuration", "contentPlayrate", "contentPlayhead",
    "contentPreload", "elapsedTime", "contentTitle", "contentId", "contentIsLive", "deviceType", "deviceGroup", "deviceManufacturer",
    "deviceModel", "deviceName", "deviceSize", "deviceUuid", "contentRenditionName", "contentIsFullscreen", "contentCdn",
    "contentFps", "asnOrganization", "asnLongitude", "asnLatitude", "asn", "timeSinceRequested", "timeSinceStarted"
]

// =====================================================================
// Connected-device pipeline constants (Vega / CAF mobile collector)
// =====================================================================
// Endpoint URLs, request payload templates, and harvest defaults for the
// connected-device pipeline (`/v5/connect` + `/v3/data`). Wire format
// mirrors `@newrelic/video-caf-js@3.1.0`.
//
// These are NAMED exports (not `Constants.*` properties) so consumers
// importing only `Constants` don't pull this Vega-specific data into
// their bundle. Only `connectedDeviceHarvester.js` imports these,
// keeping the Browser bundle lean.

/** US production mobile collector base URL. */
export const MOBILE_ENDPOINT_US = "https://mobile-collector.newrelic.com/mobile";

/** EU production mobile collector base URL. Routes EU-account events to the EU datacenter. */
export const MOBILE_ENDPOINT_EU = "https://mobile-collector.eu01.nr-data.net/mobile";

/** Staging mobile collector base URL. */
export const STAGING_MOBILE_ENDPOINT =
  "https://staging-mobile-collector.newrelic.com/mobile";

/** Endpoint region selector. Each value routes to its regional collector. */
export const NR_ENDPOINT = {
  US: "US",
  EU: "EU",
  STAGING: "staging",
};

/** Default harvest cadence in ms. */
export const DEFAULT_HARVEST_TIME = 60_000;

/** Default in-memory event-buffer cap (informational; aggregator enforces
 *  MAX_EVENTS_PER_BATCH / MAX_PAYLOAD_SIZE). */
export const DEFAULT_BUFFER_SIZE = 100;

/**
 * Positional 2-tuple sent as the body of `POST /v5/connect`.
 *   [
 *     appInfo[3]    = [appName, appVersion, bundleId],
 *     deviceInfo[10] = [osName, osVersion, deviceModel, agentName,
 *                       agentVersion, deviceUuid, "", "",
 *                       manufacturer, sizeMeta]
 *   ]
 *
 * Mirrors `@newrelic/video-caf-js@3.1.0`'s DATA_TOKENS_PAYLOAD shape.
 * Empty strings are rejected with a 401 — every slot must carry a
 * non-empty token. CAF uses `osName='Android'` + `agentName='AndroidAgent'`
 * for collector auth; the real device identity is recorded in slot [1] /
 * slot [8] of `/v3/data`.
 */
export const CD_DATA_TOKENS_PAYLOAD = [
  // appInfo
  [
    "newrelic_mobile_example", // appName
    "1.1", // appVersion
    "com.newrelic.newrelic_mobile_example", // bundleId
  ],
  // deviceInfo
  [
    "Android", // osName       (collector expects a recognized osName here)
    "14", // osVersion        
    "sdk_gphone64_arm64", // deviceModel     
    "AndroidAgent", // agentName     (collector expects a recognized agentName)
    "7.4.0-alpha01", // agentVersion  
    "b797aee6-aa69-4879-9ba3-1f4aed1a7777", // deviceUuid 
    "",
    "",
    "Google", // manufacturer
    {
      size: "normal",
      platform: "Flutter",
      platformVersion: "1.0.8", // 
    },
  ],
];

/**
 * Slot [1] of the `POST /v3/data` 10-tuple. Real device identity tuple
 * (Vega + Amazon by default). Customer-supplied `info.deviceInfo` overrides
 * the runtime fields; static slots (osName, agentName, etc.) stay fixed.
 */
export const CD_DEVICE_INFO = [
  "Vega", // osName
  "1.0", // osVersion        
  "VegaDevice", // deviceModel       
  "VegaAgent", // agentName
  "1.0.0", // agentVersion      
  "00000000-0000-0000-0000-000000000000", // deviceUuid 
  "",
  "",
  "Amazon", // manufacturer
  {
    size: "normal",
    platform: "Native",
    platformVersion: "1.0.0", // 
  },
];

/**
 * Slot [8] of the `POST /v3/data` 10-tuple. Session metadata. Device-identity
 * fields (osVersion, deviceModel, deviceManufacturer, osMajorVersion) are
 * NOT duplicated here — they ship in slot [1] (`CD_DEVICE_INFO`).
 */
export const CD_METADATA = {
  osBuild: "1",
  osName: "Vega",
  platform: "Native",
  appBuild: "1",
  architecture: "aarch64",
};

export default Constants;
