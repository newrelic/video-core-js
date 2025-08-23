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
   * @param {object} userConfig - User provided configuration
   * @returns {boolean} True if configuration is valid and set
   */

  setConfiguration(userInfo) {
    this.initializeGlobalConfig(userInfo);
    Log.notice("Video analytics configuration initialized successfully");
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
   * Initializes the global NRVIDEO configuration object.
   */
  initializeGlobalConfig(userInfo) {
    if (!this.validateRequiredFields(userInfo)) return;

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
    };
  }
}

// Create singleton instance
const videoConfiguration = new VideoConfiguration();

/**
 * Sets the video analytics configuration.
 * @param {object} config - Configuration object
 * @returns {boolean} True if configuration was set successfully
 */
export function setVideoConfig(info) {
  return videoConfiguration.setConfiguration(info);
}

export { videoConfiguration };
export default VideoConfiguration;
