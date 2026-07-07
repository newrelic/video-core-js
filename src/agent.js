import { HarvestScheduler } from "./harvestScheduler.js";
import { NrVideoEventAggregator } from "./eventAggregator.js";
import Constants from "./constants.js";
import Log from "./log.js";
import Tracker from "./tracker";

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
      if(eventObject.actionName && eventObject.actionName === Tracker.Events.QOE_AGGREGATE) {
          // Ensure only one QOE_AGGREGATE event per (actionName + viewId) in buffer per harvest cycle.
          // Each player has a unique viewId, so multi-player scenarios are handled correctly.
          // Dirty-check dedup happens at drain time in HarvestScheduler._qoeKpisUnchanged().
          if (eventObject.viewId) {
              return this.eventBuffer.addOrReplaceByActionNameAndViewId(
                  Tracker.Events.QOE_AGGREGATE,
                  eventObject.viewId,
                  eventObject
              );
          }
          return this.eventBuffer.addOrReplaceByActionName(Tracker.Events.QOE_AGGREGATE, eventObject);
      }
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
    if (!this.eventBuffer || !freshKpis) return;
    const existing = viewId
      ? this.eventBuffer.findByActionNameAndViewId(Tracker.Events.QOE_AGGREGATE, viewId)
      : this.eventBuffer.findByActionName(Tracker.Events.QOE_AGGREGATE);
    if (existing) {
      const updated = { ...existing };
      for (const key of Constants.QOE_KPI_KEYS) {
        if (key in freshKpis) {
          updated[key] = freshKpis[key];
        }
      }
      if (viewId) {
        this.eventBuffer.addOrReplaceByActionNameAndViewId(Tracker.Events.QOE_AGGREGATE, viewId, updated);
      } else {
        this.eventBuffer.addOrReplaceByActionName(Tracker.Events.QOE_AGGREGATE, updated);
      }
    }
  }
}

// Create singleton instance
const videoAnalyticsAgent = new VideoAnalyticsAgent();

// Enhanced video analytics harvester
export const videoAnalyticsHarvester = videoAnalyticsAgent;
