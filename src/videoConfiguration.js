import Log from "./log";
import Constants from "./constants";

const { COLLECTOR } = Constants;

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

  setConfiguration(userInfo, config, src) {
    // Validation branches by `src`. The Vega pipeline uses `applicationToken`
    // + `endpoint`; the existing NR pipeline uses `licenseKey`. (REQ-CO-5 b)
    const validated = src === "Vega"
      ? this.validateVegaFields(userInfo)
      : this.validateRequiredFields(userInfo);
    if (!validated) {
      return false;
    }
    if (!this.validateConfigFields(config)) {
      return false;
    }
    this.initializeGlobalConfig(userInfo, config, src);
    Log.notice("Video analytics configuration initialized successfully");
    return true;
  }

  /**
   * Validates required Vega configuration fields. (REQ-CO-5 b)
   * @param {object} info
   * @returns {boolean} True if valid
   */
  validateVegaFields(info) {
    if (!info || typeof info !== "object") {
      Log.error("Configuration must be an object");
      return false;
    }
    if (!info.applicationToken) {
      Log.error("applicationToken is required");
      return false;
    }
    if (!["US", "EU", "staging"].includes(info.endpoint)) {
      Log.error("Invalid endpoint (must be US, EU, or staging)");
      return false;
    }
    return true;
  }

  /**
   * Validates required configuration fields.
   * @param {object} config - Configuration to validate
   * @returns {boolean} True if valid
   */
  validateRequiredFields(info) {
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
  validateConfigFields(config) {
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
  filterObfuscateRules(rules) {
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
   * Sanitizes qoeIntervalFactor, defaulting to 2 if the value is not a positive integer.
   * @param {*} value
   * @returns {number}
   */
  sanitizeQoeIntervalFactor(value) {
    if (value === undefined || value === null) return 2;
    if (typeof value === "number" && Number.isInteger(value) && value >= 1) return value;
    Log.warn(`Invalid qoeIntervalFactor "${value}" — must be a positive integer. Defaulting to 2.`);
    return 2;
  }

  /**
   * Initializes the global NRVIDEO configuration object.
   * @param {object} userInfo - User provided configuration
   * @param {object} [config] - Optional configuration object
   */
  initializeGlobalConfig(userInfo, config, src) {
    // Vega path: write `globalThis.__NRVIDEO_CD__` with info+config only.
    // The harvester is owned by `connectedDeviceAgent.js` as a module singleton — no
    // harvester field on this global. (REQ-CO-5 c)
    if (src === "Vega") {
      globalThis.__NRVIDEO_CD__ = {
        info: {
          accountId: userInfo.accountId,
          applicationToken: userInfo.applicationToken,
          endpoint: userInfo.endpoint,
          ...(userInfo.appName ? { appName: userInfo.appName } : {}),
          ...(userInfo.applicationID ? { applicationID: userInfo.applicationID } : {}),
          ...(userInfo.deviceInfo ? { deviceInfo: userInfo.deviceInfo } : {}),
        },
        config: {
          qoeAggregate: config?.qoeAggregate ?? false,
          qoeIntervalFactor: this.sanitizeQoeIntervalFactor(config?.qoeIntervalFactor),
          obfuscate: this.filterObfuscateRules(config?.obfuscate),
        },
      };
      return;
    }

    // NR path — unchanged.
    let { licenseKey, appName, region, beacon, applicationID } = userInfo;

    if (region === "US") {
      beacon = Constants.COLLECTOR["US"][0];
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
export function setVideoConfig(info, config, src) {
  return videoConfiguration.setConfiguration(info, config, src);
}

export { videoConfiguration };
export default VideoConfiguration;
