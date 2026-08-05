// =====================================================================
// Connected-device pipeline constants (Vega / mobile collector)
// =====================================================================
// Endpoint URLs, request payload templates, and harvest defaults for the
// connected-device pipeline (`/v5/connect` + `/v3/data`).
// Only `connectedDeviceHarvester.js` imports these — browser builds
// never reference this file, keeping the browser bundle lean.

/**
 * Maps region key (lowercase) directly to the regional mobile collector base URL.
 * Accepts global.region.key values: us, eu, gov, jp, staging.
 */
export const ENDPOINT_URL = {
  us:      "https://mobile-collector.newrelic.com/mobile",
  eu:      "https://mobile-collector.eu01.nr-data.net/mobile",
  staging: "https://staging-mobile-collector.newrelic.com/mobile",
  gov:     "https://gov-mobile-collector.newrelic.com/mobile",
  jp:      "https://mobile-collector.jp.nr-data.net/mobile",
};

/** Default harvest cadence in ms. */
export const DEFAULT_HARVEST_TIME = 60000;

/** Default in-memory event-buffer cap (informational; aggregator enforces
 *  MAX_EVENTS_PER_BATCH / MAX_PAYLOAD_SIZE). */
export const DEFAULT_BUFFER_SIZE = 100;

/** Maximum number of /v5/connect attempts before giving up. */
export const CD_CONNECT_MAX_ATTEMPTS = 3;

/** Fixed delay between /v5/connect retry attempts in ms.
 *  10s gives the device network stack enough time to recover after
 *  wake-from-sleep before the next attempt fires. */
export const CD_CONNECT_RETRY_DELAY_MS = 10000;

/** Hard timeout for POST /v5/connect. A hung connect holds _isFetchingToken=true
 *  forever, blocking all future reconnect attempts. */
export const CD_CONNECT_TIMEOUT_MS = 10000;

/** Hard timeout for POST /v3/data. A hung data send holds isHarvesting=true,
 *  freezing the chained harvest timer until the fetch resolves. */
export const CD_DATA_TIMEOUT_MS = 30000;

/**
 * Positional 2-tuple sent as the body of `POST /v5/connect`.
 *   [
 *     appInfo[3]     = [appName, appVersion, bundleId],
 *     deviceInfo[10] = [osName, osVersion, deviceModel, agentName,
 *                       agentVersion, deviceUuid, "", "",
 *                       manufacturer, sizeMeta]
 *   ]
 *
 * DATA_TOKENS_PAYLOAD shape — empty strings are rejected with a 401,
 * every slot must carry a non-empty token. Uses `osName='Android'` +
 * `agentName='AndroidAgent'` for collector auth; the real device identity
 * is recorded in slot [1] / slot [8] of `/v3/data`.
 */
export const CD_DATA_TOKENS_PAYLOAD = [
  // appInfo
  [
    "newrelic_mobile_example", // appName
    "1.1",                     // appVersion
    "com.newrelic.newrelic_mobile_example", // bundleId
  ],
  // deviceInfo
  [
    "Android",                 // osName       (collector expects a recognized osName)
    "14",                      // osVersion
    "sdk_gphone64_arm64",      // deviceModel
    "AndroidAgent",            // agentName    (collector expects a recognized agentName)
    "7.4.0-alpha01",           // agentVersion
    "b797aee6-aa69-4879-9ba3-1f4aed1a7777", // deviceUuid
    "",
    "",
    "Google",                  // manufacturer
    {
      size: "normal",
      platform: "Flutter",
      platformVersion: "1.0.8",
    },
  ],
];

/**
 * Slot [1] of the `POST /v3/data` 10-tuple. Real device identity tuple
 * (Vega + Amazon by default). Customer-supplied `info.deviceInfo` overrides
 * the runtime fields; static slots (osName, agentName, etc.) stay fixed.
 */
export const CD_DEVICE_INFO = [
  "Vega",                                    // osName
  "1.0",                                     // osVersion
  "VegaDevice",                              // deviceModel
  "VegaAgent",                               // agentName
  "1.0.0",                                   // agentVersion
  "00000000-0000-0000-0000-000000000000",    // deviceUuid
  "",
  "",
  "Amazon",                                  // manufacturer
  {
    size: "normal",
    platform: "Native",
    platformVersion: "1.0.0",
  },
];

export const CD_METADATA = {
  osBuild:      "1",
  osName:       "Vega",
  platform:     "Native",
  appBuild:     "1",
  architecture: "aarch64",
};
