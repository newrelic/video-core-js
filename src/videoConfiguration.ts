import Log from "./log";
import Constants from "./constants";
import { ENDPOINT_URL, VegaEndpoint } from "./connectedDevice/connectedDeviceConstants";
import { ObfuscationRule } from "./obfuscate";

const { COLLECTOR } = Constants;

export interface NrVideoBrowserInfo {
  region?: string;
  beacon: string;
  licenseKey: string;
  applicationID?: string;
  appName?: string;
}

export interface NrVideoBrowserConfig {
  qoeAggregate: boolean;
  qoeIntervalFactor: number;
  obfuscate: ObfuscationRule[];
}

export interface NrVideoCdInfo {
  accountId?: string;
  applicationToken: string;
  endpoint: VegaEndpoint;
  appName?: string;
  applicationID?: string;
  deviceInfo?: unknown;
}

export interface NrVideoCdConfig {
  qoeAggregate: boolean;
  qoeIntervalFactor: number;
  obfuscate: ObfuscationRule[];
}

/** Raw, unvalidated user-supplied config — shape varies by pipeline (`src`). */
export type RawVideoConfigInfo = Record<string, any>;
export type RawVideoConfigOptions = Record<string, any>;

/**
 * Enhanced video analytics configuration system that extends the existing auth configuration.
 * Provides feature flags, retry policies, and advanced harvesting options.
 */
class VideoConfiguration {
  /**
   * Validates and sets the video analytics configuration.
   * @param {object} userInfo - User provided configuration
   * @param {object} [config] - Optional configuration object
   * @returns {boolean} True if configuration is valid and set
   */

  setConfiguration(userInfo: RawVideoConfigInfo, config?: RawVideoConfigOptions, src?: string): boolean {
    // Browser-agent fallback and overwrite-protection only apply to the
    // window.NRVIDEO (non-Vega) pipeline — Vega's info shape
    // (applicationToken/endpoint) has no browser-agent equivalent to fall
    // back to, and a later no-op call there is already a no-op by virtue of
    // requiring applicationToken every time (unchanged).
    //
    // A later call with no new info (e.g. a second Core.addTracker(tracker,
    // {config: {...}}) that isn't trying to change licenseKey/applicationID)
    // must not silently re-derive from the browser agent and clobber config
    // that was already explicitly set — explicit intent from an earlier call
    // wins over an incidental browser agent fallback on a later one.
    if (src !== "Vega" && this.isEmptyInfo(userInfo) && this.hasExistingConfig()) {
      return true;
    }

    const resolvedInfo = src === "Vega" ? userInfo : this.resolveUserInfo(userInfo);

    const validated = src === "Vega"
      ? this.validateVegaFields(resolvedInfo)
      : this.validateRequiredFields(resolvedInfo);
    if (!validated) {
      return false;
    }
    if (!this.validateConfigFields(config)) {
      return false;
    }
    this.initializeGlobalConfig(resolvedInfo, config, src);
    Log.notice("Video analytics configuration initialized successfully");
    return true;
  }

  /**
   * Validates required Vega configuration fields.
   * @param {object} info
   * @returns {boolean} True if valid
   */
  validateVegaFields(info: RawVideoConfigInfo): boolean {
    if (!info || typeof info !== "object") {
      Log.error("Configuration must be an object");
      return false;
    }
    if (!info.applicationToken) {
      Log.error("applicationToken is required");
      return false;
    }
    if (!(info.endpoint?.toLowerCase() in ENDPOINT_URL)) {
      Log.error("Invalid endpoint (must be us, eu, staging, gov, or jp)");
      return false;
    }
    return true;
  }

  /**
   * True when userInfo is genuinely omitted (undefined) or an empty object —
   * i.e. the caller supplied no new info at all. Deliberately does NOT treat
   * null/arrays/primitives as "empty" — those remain invalid-type inputs
   * that must still fail validation the same way they always have.
   * @param {*} userInfo
   * @returns {boolean}
   */
  isEmptyInfo(userInfo: any): boolean {
    return (
      userInfo === undefined ||
      (typeof userInfo === "object" &&
        userInfo !== null &&
        !Array.isArray(userInfo) &&
        Object.keys(userInfo).length === 0)
    );
  }

  /**
   * True if video config has already been successfully set (by an earlier
   * explicit call or an earlier browser-agent fallback).
   * @returns {boolean}
   */
  hasExistingConfig(): boolean {
    return typeof window !== "undefined" && !!window.NRVIDEO?.info?.licenseKey;
  }

  /**
   * Resolves the effective info config, falling back to the browser agent's
   * licenseKey/applicationID/beacon (NREUM.info) when the caller omits them
   * and a browser agent is initialized on the same page. Explicit fields on
   * userInfo always take precedence over the browser agent's values.
   * @param {object} [userInfo] - User provided configuration
   * @returns {*} Effective info to validate/use — may be the original
   *   userInfo unchanged if it's not a plain object (so invalid-type inputs
   *   still fail validation the same way they did before this fallback existed).
   */
  resolveUserInfo(userInfo: any): any {
    const isPlainObject =
      userInfo !== null &&
      typeof userInfo === "object" &&
      !Array.isArray(userInfo);

    if (userInfo !== undefined && !isPlainObject) {
      return userInfo;
    }

    const browserAgentInfo = this.getBrowserAgentConfig();
    if (!browserAgentInfo) {
      return userInfo;
    }

    return { ...browserAgentInfo, ...(userInfo || {}) };
  }

  /**
   * Reads licenseKey/applicationID/beacon off the browser agent's global
   * config if present. Checks two sources, since which one holds the real
   * values depends on how the browser agent was loaded:
   *  - window.NREUM.info / window.newrelic.info — populated directly when the
   *    agent is loaded via the CDN <script> snippet (info is seeded on the
   *    global *before* the agent runs).
   *  - window.NREUM.initializedAgents[id].info — populated for EVERY agent
   *    instance regardless of load mechanism, but is the ONLY place the real
   *    licenseKey ends up when the agent is constructed via npm with an
   *    explicit `info` passed directly to `new BrowserAgent({ info })`,
   *    since that only sets the info on the instance, not on window.NREUM.info.
   *
   * window.NREUM/window.newrelic is owned by the browser agent, not this
   * library — there's no ambient type for it in global.d.ts (which is
   * explicitly scoped to the two slots this library itself writes), so this
   * reads it via a loose cast rather than extending that file's documented
   * scope.
   * @returns {?object} { licenseKey, applicationID, beacon } or null if no
   *   browser agent with a licenseKey is present on the page.
   */
  getBrowserAgentConfig(): { licenseKey: string; applicationID?: string; beacon?: string } | null {
    if (typeof window === "undefined") {
      return null;
    }

    const win = window as any;
    const nr = win.NREUM || win.newrelic;
    if (!nr) {
      return null;
    }

    let info = nr.info;
    if (!info || !info.licenseKey) {
      const agents = nr.initializedAgents
        ? Object.values(nr.initializedAgents)
        : [];
      const agentWithInfo: any = agents.find((agent: any) => agent?.info?.licenseKey);
      info = agentWithInfo?.info;
    }

    if (!info || !info.licenseKey) {
      return null;
    }

    return {
      licenseKey: info.licenseKey,
      applicationID: info.applicationID,
      beacon: info.beacon,
    };
  }

  /**
   * Validates required configuration fields.
   * @param {object} config - Configuration to validate
   * @returns {boolean} True if valid
   */
  validateRequiredFields(info: RawVideoConfigInfo): boolean {
    if (!info || typeof info !== "object") {
      Log.error("Configuration must be an object");
      return false;
    }

    const { licenseKey, appName, region, applicationID, beacon } = info;

    if (!licenseKey) {
      Log.error("licenseKey is required");
      return false;
    }

    if (applicationID) {
      if (!beacon) {
        Log.error("beacon is required when applicationID is provided");
        return false;
      } else {
        const validBeacons = Object.values(COLLECTOR).flatMap((el) => el);
        if (!validBeacons.includes(beacon)) {
          Log.error(`Invalid beacon: ${beacon}`);
          return false;
        }
      }
    } else {
      if (!appName || !region) {
        Log.error(
          "appName and region are required when applicationID is not provided"
        );
        return false;
      }

      if (!COLLECTOR[region]) {
        Log.error(
          `Invalid region: ${region}. Valid regions are: ${Object.keys(
            COLLECTOR
          ).join(", ")}`
        );
        return false;
      }
    }

    return true;
  }

  /**
   * Validates optional config fields.
   * @param {object} config - Config to validate
   * @returns {boolean} True if valid
   */
  validateConfigFields(config?: RawVideoConfigOptions): boolean {
    if (config === null || config === undefined) {
      return true;
    }

    if (typeof config !== "object" || Array.isArray(config)) {
      Log.error("config must be an object");
      return false;
    }

    const { qoeAggregate, obfuscate } = config;

    if (qoeAggregate !== undefined && typeof qoeAggregate !== "boolean") {
      Log.error("qoeAggregate must be a boolean");
      return false;
    }

    if (obfuscate !== undefined && !Array.isArray(obfuscate)) {
      Log.error("obfuscate must be an array");
      return false;
    }

    return true;
  }

  /**
   * Filters obfuscation rules, warning about and removing invalid ones.
   * @param {Array} rules - Raw obfuscation rules
   * @returns {Array} Valid rules only
   */
  filterObfuscateRules(rules?: any[]): ObfuscationRule[] {
    if (!rules) return [];
    return rules.filter((rule) => {
      const hasRegex = rule.regex !== undefined && (typeof rule.regex === "string" || rule.regex instanceof RegExp);
      const hasReplacement = rule.replacement !== undefined && typeof rule.replacement === "string";
      if (!hasRegex || !hasReplacement) {
        Log.warn("obfuscate rule missing required 'regex' (string|RegExp) and/or 'replacement' (string), skipping:", rule);
        return false;
      }
      return true;
    });
  }

  /**
   * Sanitizes qoeIntervalFactor, defaulting to Constants.DEFAULT_QOE_INTERVAL_FACTOR
   * if the value is not a positive integer.
   * @param {*} value
   * @returns {number}
   */
  sanitizeQoeIntervalFactor(value: unknown): number {
    if (value === undefined || value === null) return Constants.DEFAULT_QOE_INTERVAL_FACTOR;
    if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
    Log.warn(`Invalid qoeIntervalFactor "${value}" — must be a positive integer. Defaulting to ${Constants.DEFAULT_QOE_INTERVAL_FACTOR}.`);
    return Constants.DEFAULT_QOE_INTERVAL_FACTOR;
  }

  /**
   * Initializes the global NRVIDEO configuration object.
   * @param {object} userInfo - User provided configuration
   * @param {object} [config] - Optional configuration object
   */
  initializeGlobalConfig(userInfo: RawVideoConfigInfo, config?: RawVideoConfigOptions, src?: string): void {
    // Vega path: write `globalThis.__NRVIDEO_CD__` with info+config only.
    // The harvester is owned by `connectedDeviceAgent.js` as a module singleton — no
    // harvester field on this global.
    if (src === "Vega") {
      globalThis.__NRVIDEO_CD__ = {
        info: {
          accountId: userInfo.accountId,
          applicationToken: userInfo.applicationToken,
          endpoint: userInfo.endpoint?.toLowerCase(),
          ...(userInfo.appName ? { appName: userInfo.appName } : {}),
          ...(userInfo.applicationID ? { applicationID: userInfo.applicationID } : {}),
          ...(userInfo.deviceInfo ? { deviceInfo: userInfo.deviceInfo } : {}),
        },
        config: {
          qoeAggregate: config?.qoeAggregate ?? true,
          qoeIntervalFactor: this.sanitizeQoeIntervalFactor(config?.qoeIntervalFactor),
          obfuscate: this.filterObfuscateRules(config?.obfuscate),
        },
      };
      return;
    }

    let { licenseKey, appName, region, beacon, applicationID } = userInfo;

    if (region === "US") {
      beacon = (Constants.COLLECTOR["US"] as string[])[0];
    } else {
      beacon = beacon || COLLECTOR[region];
    }

    window.NRVIDEO = {
      // Existing format for backward compatibility
      info: {
        ...(region ? { region } : {}), // Only include region if available
        beacon,
        licenseKey,
        applicationID,
        ...(applicationID ? {} : { appName }), // Only include appName when no applicationID
      },
      config: {
        qoeAggregate: config?.qoeAggregate ?? true,
        qoeIntervalFactor: this.sanitizeQoeIntervalFactor(config?.qoeIntervalFactor),
        obfuscate: this.filterObfuscateRules(config?.obfuscate),
      }
    };
  }
}

// Create singleton instance
const videoConfiguration = new VideoConfiguration();

/**
 * Sets the video analytics configuration.
 * @param {object} info - Info configuration object
 * @param {object} [config] - Optional configuration object
 * @returns {boolean} True if configuration was set successfully
 */
export function setVideoConfig(info: RawVideoConfigInfo, config?: RawVideoConfigOptions, src?: string): boolean {
  return videoConfiguration.setConfiguration(info, config, src);
}

export { videoConfiguration };
export default VideoConfiguration;
