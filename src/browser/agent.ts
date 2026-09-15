import { HarvestScheduler } from "./harvestScheduler";
import { NrVideoEventAggregator } from "../eventAggregator";
import Log from "../log";
import { registerHarvester } from "../recordEvent";
import {
  bufferEventWithQoeDedup,
  refreshQoeKpisInBuffer,
} from "../utils/qoeFilters";
import { EventAttributes, Harvester } from "../utils/eventBuilder";

/**
 * Enhanced video analytics agent with HarvestScheduler only.
 */
class VideoAnalyticsAgent implements Harvester {
  isInitialized: boolean;
  harvestScheduler: HarvestScheduler | null;
  eventBuffer: NrVideoEventAggregator | null;

  constructor() {
    this.isInitialized = false;
    this.harvestScheduler = null;
    this.eventBuffer = null;
  }

  /**
   * Initializes the video analytics agent with enhanced HarvestScheduler.
   */
  initialize(): void {
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
    } catch (error: any) {
      Log.error("Failed to initialize video analytics agent:", error.message);
    }
  }

  /**
   * Adds an event to the harvesting system.
   * @param {object} eventObject - Event to add
   * @returns {boolean} True if event was added successfully
   */
  addEvent(eventObject: EventAttributes): boolean {
    if (!this.isInitialized) {
      Log.warn("Video analytics agent not initialized, initializing now");
      this.initialize();
    }

    try {
      // QOE_AGGREGATE dedup + plain append, shared with the Vega pipeline.
      return bufferEventWithQoeDedup(this.eventBuffer as NrVideoEventAggregator, eventObject);
    } catch (error: any) {
      Log.error("Failed to add event to harvesting system:", error.message);
      return false;
    }
  }

  /**
   * Sets the harvest interval for the scheduler.
   * @param {number} interval - The harvest interval in milliseconds.
   */

  setHarvestInterval(interval: number): void {
    if (!this.isInitialized) {
      this.initialize();
    }

    (this.harvestScheduler as HarvestScheduler).updateHarvestInterval(interval);
  }

  /**
   * Forces the next harvest cycle to include QOE_AGGREGATE events.
   * Called at CONTENT_END to ensure final QoE is sent.
   */
  forceNextQoeCycle(): void {
    if (this.harvestScheduler) {
      this.harvestScheduler.forceNextQoeCycle = true;
    }
  }

  /**
   * Sets a callback to be called before each drain to refresh QoE KPIs.
   * @param {Function|null} callback - Function that refreshes QoE data in the buffer, or null to clear
   */
  setBeforeDrainCallback(callback: (() => void) | null): void {
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
  refreshQoeKpis(freshKpis: EventAttributes, viewId?: string): void {
    refreshQoeKpisInBuffer(this.eventBuffer as NrVideoEventAggregator, freshKpis, viewId);
  }
}

// Create singleton instance
const videoAnalyticsAgent = new VideoAnalyticsAgent();

// Self-register for the 'Browser' routing key. Importing this module is what
// makes the Browser pipeline reachable in the consumer's bundle.
registerHarvester("Browser", videoAnalyticsAgent);

// Enhanced video analytics harvester
export const videoAnalyticsHarvester = videoAnalyticsAgent;
