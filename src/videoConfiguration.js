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
    try {
      if (!this.validateConfiguration(userInfo)) {
        throw new Error("Invalid video analytics configuration provided");
      }

      
      // Set global configuration
      this.initializeGlobalConfig(userInfo);
      
      Log.notice("Video analytics configuration initialized successfully");
      return true;
    } catch (error) {
      Log.error("Failed to set video analytics configuration:", error.message);
      return false;
    }
  }

  /**
   * Validates the provided configuration object.
   * @param {object} config - Configuration to validate
   * @returns {boolean} True if valid
   */
  validateConfiguration(info) {
    if (!info || typeof info !== 'object') {
      Log.error("Configuration must be an object");
      return false;
    }

     if(! this.validateRequiredFields(info) ){
       Log.error("Required info key values are missing");
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
    const { licenseKey, appName, region, applicationID, beacon } = info;
    
    if (!licenseKey) {
      Log.error("licenseKey is required");
      return false;
    }

    if (applicationID) {
      if (!beacon) {
        Log.error("beacon is required when applicationID is provided");
        return false;
      }
    } else {
      if (!appName || !region) {
        Log.error("appName and region are required when applicationID is not provided");
        return false;
      }
      
      if (!COLLECTOR[region]) {
        Log.error(`Invalid region: ${region}. Valid regions are: ${Object.keys(COLLECTOR).join(', ')}`);
        return false;
      }
    }

    return true;
  }



  /**
   * Initializes the global NRVIDEO configuration object.
   */
  initializeGlobalConfig(userInfo) {
    let { licenseKey, appName, region, beacon, applicationID } = userInfo;

    if(region === "US"){
      beacon = Constants.COLLECTOR['US'][0];
    }else{
      beacon = beacon || COLLECTOR[region]
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
