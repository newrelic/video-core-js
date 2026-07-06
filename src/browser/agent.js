import { HarvestScheduler } from "./harvestScheduler.js";
import { NrVideoEventAggregator } from "../eventAggregator.js";
import Log from "../log.js";
import { registerHarvester } from "../recordEvent.js";
import {
  bufferEventWithQoeDedup,
  refreshQoeKpisInBuffer,
} from "../utils/qoeFilters";

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
      // QOE_AGGREGATE dedup + plain append, shared with the Vega pipeline.
      return bufferEventWithQoeDedup(this.eventBuffer, eventObject);
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

  /**
   * Forces the next harvest cycle to include QOE_AGGREGATE events.
   * Called at CONTENT_END to ensure final QoE is sent.
   */
  forceNextQoeCycle() {
    if (this.harvestScheduler) {
      this.harvestScheduler.forceNextQoeCycle = true;
    }
  }

  /**
   * Sets a callback to be called before each drain to refresh QoE KPIs.
   * @param {Function|null} callback - Function that refreshes QoE data in the buffer, or null to clear
   */
  setBeforeDrainCallback(callback) {
    if (this.harvestScheduler) {
      this.harvestScheduler.beforeDrainCallback = callback;
    }
  }

  /**
   * Updates QoE KPI fields on the existing QOE_AGGREGATE event in the buffer.
   * Scoped to a specific viewId to support multiple players on the same page.
   * @param {object} freshKpis - Object with latest KPI values
   * @param {string} [viewId] - The viewId of the player whose QoE event to update
   */
  refreshQoeKpis(freshKpis, viewId) {
    refreshQoeKpisInBuffer(this.eventBuffer, freshKpis, viewId);
  }
}

// Create singleton instance
const videoAnalyticsAgent = new VideoAnalyticsAgent();

// Self-register for the 'Browser' routing key. Importing this module is what
// makes the Browser pipeline reachable in the consumer's bundle.
registerHarvester("Browser", videoAnalyticsAgent);

// Enhanced video analytics harvester
export const videoAnalyticsHarvester = videoAnalyticsAgent;
