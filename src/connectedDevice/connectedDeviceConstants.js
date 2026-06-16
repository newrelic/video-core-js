/**
 * Constants for the Vega pipeline.
 *
 * Endpoint URLs, request payload templates, and harvest defaults for shipping
 * video analytics from the Amazon Vega SDK (Kepler / Fire TV class devices)
 * to NR's mobile collector via the CAF protocol (`/v5/connect` + `/v3/data`).
 *
 * Wire format mirrors `@newrelic/video-caf-js@3.1.0`.
 *
 * @module connectedDeviceConstants
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
 * Mirrors `@newrelic/video-caf-js@3.1.0`'s DATA_TOKENS_PAYLOAD shape (which
 * the mobile collector accepts in production for Chromecast). Empty strings
 * here are rejected with a 401 — every slot must carry a non-empty token, so
 * we ship safe defaults that the collector parses cleanly. CAF uses
 * `osName='Android'` + `agentName='AndroidAgent'` in its connect payload
 * regardless of the actual device, so we do the same — the device identity
 * is correctly recorded in the /v3/data DEVICE_INFO + METADATA slots later.
 *
 * TODO(OQ-1): replace these with real runtime values from
 * `newrelic-vega-agent` (osVersion, deviceModel, deviceUuid, agentVersion,
 * platformVersion). Static placeholders ship for v1.
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
    "14", // osVersion         TODO(OQ-1)
    "sdk_gphone64_arm64", // deviceModel       TODO(OQ-1)
    "AndroidAgent", // agentName     (collector expects a recognized agentName)
    "7.4.0-alpha01", // agentVersion  TODO(OQ-1)
    "b797aee6-aa69-4879-9ba3-1f4aed1a7777", // deviceUuid TODO(OQ-1)
    "",
    "",
    "Google", // manufacturer
    {
      size: "normal",
      platform: "Flutter",
      platformVersion: "1.0.8", // TODO(OQ-1)
    },
  ],
];

// ====== DATA PAYLOAD SLOTS ======

/**
 * Slot [1] of the `POST /v3/data` 10-tuple. Same shape as the connect-payload
 * deviceInfo. (REQ-VC-7)
 *
 * Unlike the connect-time deviceInfo (which has to look like an Android app to
 * pass the collector's auth check), this slot is the *real* device identity
 * recorded against the data — Vega + Amazon. Mirror of CAF's DEVICE_INFO
 * shape with Vega-flavored values.
 *
 * TODO(OQ-1): wire real values from `newrelic-vega-agent` runtime
 * (osVersion, deviceModel, deviceUuid, agentVersion, platformVersion).
 */
export const CD_DEVICE_INFO = [
  "Vega", // osName
  "1.0", // osVersion         TODO(OQ-1)
  "VegaDevice", // deviceModel       TODO(OQ-1)
  "VegaAgent", // agentName
  "1.0.0", // agentVersion      TODO(OQ-1)
  "00000000-0000-0000-0000-000000000000", // deviceUuid TODO(OQ-1)
  "",
  "",
  "Amazon", // manufacturer
  {
    size: "normal",
    platform: "Native",
    platformVersion: "1.0.0", // TODO(OQ-1)
  },
];

/**
 * Slot [8] of the `POST /v3/data` 10-tuple. Session metadata. (REQ-VC-8)
 *
 * Device-identity fields (osVersion, deviceModel, deviceManufacturer,
 * osMajorVersion) are NOT duplicated here — they ship in slot [1]
 * (`CD_DEVICE_INFO`) and the collector reads them from there.
 */
export const CD_METADATA = {
  osBuild: "1",
  osName: "Vega",
  platform: "Native",
  appBuild: "1",
  architecture: "aarch64",
};
