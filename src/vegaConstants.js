/**
 * Constants for the Vega pipeline.
 *
 * Endpoint URLs, request payload templates, and harvest defaults for shipping
 * video analytics from the Amazon Vega SDK (Kepler / Fire TV class devices)
 * to NR's mobile collector via the CAF protocol (`/v5/connect` + `/v3/data`).
 *
 * Wire format mirrors `@newrelic/video-caf-js@3.1.0`.
 *
 * @module vegaConstants
 */

// ====== ENDPOINT BASE URLS ======

/** Production mobile collector base URL. (REQ-VC-1) */
export const MOBILE_ENDPOINT = "https://mobile-collector.newrelic.com/mobile";

/** Staging mobile collector base URL. (REQ-VC-2) */
export const STAGING_MOBILE_ENDPOINT =
  "https://staging-mobile-collector.newrelic.com/mobile";

/**
 * Endpoint region selector. Both `US` and `EU` resolve to the same prod URL —
 * matches CAF's behavior. `STAGING` switches to the staging host. (REQ-VC-3)
 */
export const NR_ENDPOINT = {
  US: "US",
  EU: "EU",
  STAGING: "staging",
};

// ====== HARVEST DEFAULTS ======

/** Default harvest cadence in ms. (REQ-VC-4) */
export const DEFAULT_HARVEST_TIME = 60_000;

/** Default in-memory event-buffer cap. (REQ-VC-5) */
export const DEFAULT_BUFFER_SIZE = 100;

// ====== CONNECT PAYLOAD ======

/**
 * Positional 2-tuple sent as the body of `POST /v5/connect`. (REQ-VC-6)
 *
 *   [
 *     appInfo[3]    = [appName, appVersion, bundleId],
 *     deviceInfo[10] = [osName, osVersion, deviceModel, agentName, agentVersion,
 *                       deviceUuid, "", "", manufacturer, sizeMeta]
 *   ]
 *
 * TODO(OQ-1): replace placeholder strings with real values from
 * `newrelic-vega-agent` runtime (osVersion, deviceModel, deviceUuid,
 * agentVersion, platformVersion). Static placeholders ship for v1.
 */
export const VEGA_DATA_TOKENS_PAYLOAD = [
  // appInfo
  ["", "", ""],
  // deviceInfo
  [
    "Vega", // osName
    "", // osVersion         TODO(OQ-1)
    "", // deviceModel       TODO(OQ-1)
    "VegaAgent", // agentName
    "", // agentVersion      TODO(OQ-1)
    "", // deviceUuid        TODO(OQ-1)
    "",
    "",
    "Amazon", // manufacturer
    {
      size: "normal",
      platform: "Native",
      platformVersion: "", // TODO(OQ-1)
    },
  ],
];

// ====== DATA PAYLOAD SLOTS ======

/**
 * Slot [1] of the `POST /v3/data` 10-tuple. Same shape as the connect-payload
 * deviceInfo. (REQ-VC-7)
 *
 * TODO(OQ-1): wire real device info from `newrelic-vega-agent` runtime.
 */
export const VEGA_DEVICE_INFO = [
  "Vega", // osName
  "", // osVersion         TODO(OQ-1)
  "", // deviceModel       TODO(OQ-1)
  "VegaAgent", // agentName
  "", // agentVersion      TODO(OQ-1)
  "", // deviceUuid        TODO(OQ-1)
  "",
  "",
  "Amazon", // manufacturer
  {
    size: "normal",
    platform: "Native",
    platformVersion: "", // TODO(OQ-1)
  },
];

/**
 * Slot [8] of the `POST /v3/data` 10-tuple. Session metadata. (REQ-VC-8)
 *
 * TODO(OQ-2): replace placeholders with real runtime values
 * (sessionId, uuid, runTime, lastInteraction, sessionDuration, etc.) from
 * `newrelic-vega-agent`. Static defaults ship for v1.
 */
export const VEGA_METADATA = {
  osBuild: "",
  newRelicVersion: "",
  osMajorVersion: "",
  sessionId: "", // TODO(OQ-2)
  osName: "Vega",
  sessionDuration: 0, // TODO(OQ-2)
  uuid: "", // TODO(OQ-2)
  platform: "Native",
  appBuild: "",
  osVersion: "", // TODO(OQ-1)
  lastInteraction: 0, // TODO(OQ-2)
  platformVersion: "", // TODO(OQ-1)
  deviceModel: "", // TODO(OQ-1)
  runTime: 0, // TODO(OQ-2)
  deviceManufacturer: "Amazon",
  architecture: "",
};
