import { HarvestScheduler } from "./harvestScheduler.js";
import { NrVideoEventAggregator } from "./eventAggregator.js";
import Log from "./log.js";

/**
 * Enhanced video analytics agent with HarvestScheduler only.
 */
class VideoAnalyticsAgent {
  constructor() {
    this.isInitialized = false;
    this.harvestScheduler = null;
    this.eventBuffer = null;
  }

  /**
   * Initializes the video analytics agent with enhanced HarvestScheduler.
   */
  initialize() {
    if (this.isInitialized) {
      Log.warn("Video analytics agent already initialized");
      return;
    }

    try {
      this.eventBuffer = new NrVideoEventAggregator();
      this.harvestScheduler = new HarvestScheduler(this.eventBuffer);

      // Start the enhanced harvest scheduler
      this.harvestScheduler.startScheduler();

      this.isInitialized = true;
      Log.notice("Video analytics agent initialized successfully");
    } catch (error) {
      Log.error("Failed to initialize video analytics agent:", error.message);
    }
  }

  /**
   * Adds an event to the harvesting system.
   * @param {object} eventObject - Event to add
   * @returns {boolean} True if event was added successfully
   */
  addEvent(eventObject) {
    if (!this.isInitialized) {
      Log.warn("Video analytics agent not initialized, initializing now");
      this.initialize();
    }

    try {
      return this.eventBuffer.add(eventObject);
    } catch (error) {
      Log.error("Failed to add event to harvesting system:", error.message);
      return false;
    }
  }

  /**
   * Sets the harvest interval for the scheduler.
   * @param {number} interval - The harvest interval in milliseconds.
   */

  setHarvestInterval(interval) {
    if (!this.isInitialized) {
      this.initialize();
    }

    this.harvestScheduler.updateHarvestInterval(interval);
  }
}

// Create singleton instance
const videoAnalyticsAgent = new VideoAnalyticsAgent();

// Enhanced video analytics harvester
export const videoAnalyticsHarvester = videoAnalyticsAgent;
