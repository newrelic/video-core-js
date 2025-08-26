import { NrVideoEventAggregator } from "./eventAggregator";
import { RetryQueueHandler } from "./retryQueueHandler";
import { OptimizedHttpClient } from "./optimizedHttpClient";
import { buildUrl, dataSize } from "./utils";
import Constants from "./constants";
import Log from "./log";

/**
 * Enhanced harvest scheduler that orchestrates the video analytics data collection,
 * processing, and transmission with smart harvesting and performance monitoring.
 */

export class HarvestScheduler {
  constructor(eventAggregator) {
    // Core components
    this.eventBuffer = eventAggregator;
    this.retryQueueHandler = new RetryQueueHandler();
    this.httpClient = new OptimizedHttpClient();
    this.fallBackUrl = "";
    this.retryCount = 0;

    // Set up smart harvest callback
    if (this.eventBuffer instanceof NrVideoEventAggregator) {
      this.eventBuffer.setSmartHarvestCallback((type, threshold) =>
        this.triggerSmartHarvest(type, threshold)
      );
    }

    // Scheduler state
    this.isStarted = false;
    this.currentTimerId = null;
    this.harvestCycle = Constants.INTERVAL;
    this.isHarvesting = false;

    // Page lifecycle handling
    this.setupPageLifecycleHandlers();
  }

  /**
   * Starts the harvest scheduler.
   */
  startScheduler() {
    if (this.isStarted) {
      Log.warn("Harvest scheduler is already started");
      return;
    }

    this.isStarted = true;

    Log.notice("Starting harvest scheduler", {
      harvestCycle: this.harvestCycle,
      eventBufferSize: this.eventBuffer ? this.eventBuffer.size() : 0,
    });

    this.scheduleNextHarvest();
  }

  /**
   * Stops the harvest scheduler.
   */
  stopScheduler() {
    if (!this.isStarted) {
      return;
    }

    this.isStarted = false;

    if (this.currentTimerId) {
      clearTimeout(this.currentTimerId);
      this.currentTimerId = null;
    }

    Log.notice("Harvest scheduler stopped");
  }

  /**
   * Triggers a smart harvest when buffer reaches threshold capacity.
   * @param {string} type - Type of harvest trigger ('smart' or 'overflow')
   * @param {number} threshold - Threshold percentage that triggered the harvest (60 or 90)
   */
  async triggerSmartHarvest(type, threshold) {
    Log.notice(`${type} harvest triggered at ${threshold}% threshold`, {
      type,
      threshold,
    });

    // If buffer is empty, abort harvest
    if (!this.eventBuffer || this.eventBuffer.isEmpty()) return;

    // Clear existing timer to prevent redundant harvests
    if (this.currentTimerId) {
      clearTimeout(this.currentTimerId);
      this.currentTimerId = null;
    }

    try {
      await this.triggerHarvest({});
    } catch (error) {
      Log.error(`${type} harvest failed:`, error.message);
    } finally {
      // Schedule next harvest after smart harvest completes
      if (this.isStarted) {
        this.scheduleNextHarvest();
      }
    }
  }

  /**
   * Schedules the next harvest based on current conditions.
   * @private
   */
  scheduleNextHarvest() {
    if (!this.isStarted) return;

    const interval = this.harvestCycle;
    this.currentTimerId = setTimeout(() => this.onHarvestInterval(), interval);
  }

  /**
   * Handles the harvest interval timer.
   * @private
   */
  async onHarvestInterval() {
    try {
      // Check if there's any data to harvest (buffer or retry queue) before starting the harvest process
      const hasBufferData = this.eventBuffer && !this.eventBuffer.isEmpty();
      const hasRetryData =
        this.retryQueueHandler && this.retryQueueHandler.getQueueSize() > 0;

      if (!hasBufferData && !hasRetryData) return;
      await this.triggerHarvest({});
    } catch (error) {
      Log.error("Error during scheduled harvest:", error.message);
    } finally {
      this.scheduleNextHarvest();
    }
  }

  /**
   * Triggers a harvest cycle with comprehensive error handling and monitoring.
   * @param {object} options - Harvest options
   * @param {boolean} options.isFinalHarvest - Whether this is a final harvest on page unload
   * @param {boolean} options.force - Force harvest even if buffer is empty
   * @returns {Promise<object>} Harvest result
   */
  async triggerHarvest(options = {}) {
    if (this.isHarvesting) {
      return { success: false, reason: "harvest_in_progress" };
    }

    this.isHarvesting = true;

    try {
      // Drain events from buffer
      let events = this.drainEvents(options);

      // For beacon harvests, trim events to fit beacon size if necessary
      if (options.isFinalHarvest) {
        const maxBeaconSize = Constants.MAX_BEACON_SIZE;
        const payloadSize = dataSize(events);

        if (payloadSize > maxBeaconSize) {
          // Trim events to fit beacon size (keep most recent events)
          events = this.trimEventsToFit(events, maxBeaconSize);
        }
      }

      // Send single payload - buffer limits guarantee it fits API constraints
      const result = await this.sendChunk(events, options, true);

      return {
        success: result.success,
        totalChunks: 1,
        results: [result],
      };
    } catch (error) {
      Log.error("Harvest cycle failed:", error.message);
      this.handleHarvestFailure(error);

      return {
        success: false,
        error: error.message,
        consecutiveFailures: this.consecutiveFailures,
      };
    } finally {
      this.isHarvesting = false;
    }
  }

  /**
   * Trims events to fit within a specified size limit for beacon harvests.
   * Keeps the most recent events and discards older ones.
   * @param {Array} events - Events to trim
   * @param {number} maxSize - Maximum payload size in bytes
   * @returns {Array} Trimmed events that fit within size limit
   * @private
   */
  trimEventsToFit(events, maxSize) {
    if (events.length === 0) return events;

    // Start from the most recent events (end of array) and work backwards
    const trimmedEvents = [];
    let currentSize = 0;

    for (let i = events.length - 1; i >= 0; i--) {
      const event = events[i];

      // Check if adding this event would exceed the limit
      const testPayloadSize = dataSize({ ins: [event, ...trimmedEvents] });

      if (testPayloadSize > maxSize) continue;

      // Add event to the beginning to maintain chronological order
      trimmedEvents.unshift(event);
      currentSize = testPayloadSize;
    }

    const discardedCount = events.length - trimmedEvents.length;
    if (discardedCount > 0) {
      const discardedEvents = events.slice(0, discardedCount);
      Log.warn(`Discarded ${discardedCount} events to fit beacon size limit`, {
        originalCount: events.length,
        trimmedCount: trimmedEvents.length,
        finalSize: currentSize,
        maxSize,
      });

      // send discarded events to retry queue
      if (this.retryQueueHandler) {
        this.retryQueueHandler.addFailedEvents(discardedEvents);
      }
    }

    return trimmedEvents;
  }

  /**
   * Drains events from the event buffer and optionally includes retry queue data.
   * Uses fresh-events-first approach with payload limits.
   * @param {object} options - Harvest options
   * @returns {Array} Drained events
   * @private
   */
  drainEvents() {
    // Always drain fresh events first (priority approach)
    const freshEvents = this.eventBuffer.drain();
    let events = [...freshEvents];
    let currentPayloadSize = dataSize(freshEvents);

    // Always check retry queue if it has data - no flags needed
    if (this.retryQueueHandler && this.retryQueueHandler.getQueueSize() > 0) {
      //const retryQueueSize = this.retryQueueHandler.getQueueSize();

      // Calculate available space for retry events
      const availableSpace = Constants.MAX_PAYLOAD_SIZE - currentPayloadSize;
      const availableEventCount =
        Constants.MAX_EVENTS_PER_BATCH - events.length;

      if (availableSpace > 0 && availableEventCount > 0) {
        const retryEvents = this.retryQueueHandler.getRetryEventsToFit(
          availableSpace,
          availableEventCount
        );

        if (retryEvents.length > 0) {
          events = [...retryEvents, ...events]; // Append retry events before fresh events for maintaining chronoligical order
        }
      }
    }
    return events;
  }

  /**
   * Sends a chunk of events using the optimized HTTP client.
   * @param {Array} chunk - Events to send
   * @param {object} options - Harvest options
   * @param {boolean} isLastChunk - Whether this is the last chunk
   * @returns {Promise<object>} Send result
   * @private
   */
  async sendChunk(chunk, options, isLastChunk) {
    const url = buildUrl(this.fallBackUrl); //
    const payload = { body: { ins: chunk } };
    const requestOptions = {
      url,
      payload,
      options: {
        ...options,
        isLastChunk,
      },
    };
    return new Promise((resolve) => {
      this.httpClient.send(requestOptions, (result) => {
        if (result.retry) {
          this.handleRequestFailure(chunk);
        } else {
          // Inline reset logic for successful request
          this.retryCount = 0;
          this.fallBackUrl = "";
        }
        resolve({
          success: !result.retry,
          status: result.status,
          error: result.error,
          chunk,
          eventCount: chunk.length,
        });
      });
    });
  }

  /**
   * Handles request failure and implements failover logic for US region.
   * @param {Array} chunk - Failed chunk to add to retry queue
   * @private
   */
  handleRequestFailure(chunk) {
    // Add failed events to retry queue
    this.retryQueueHandler.addFailedEvents(chunk);
    // Only apply failover logic for US region
    if (window.NRVIDEO?.info?.region !== "US") return;
    this.retryCount++;
    if (this.retryCount > 5) {
      // Reset to primary endpoint after too many failures
      this.retryCount = 0;
      this.fallBackUrl = "";
    } else if (this.retryCount >= 2) {
      // Switch to fallback after 2 consecutive failures
      this.fallBackUrl = Constants.COLLECTOR["US"][1];
    }
  }

  /**
   * Handles harvest failure scenarios.
   * @param {Error} error - Harvest error
   * @private
   */
  handleHarvestFailure(error) {
    this.consecutiveFailures++;

    Log.warn("Harvest failure handled", {
      error: error.message,
      consecutiveFailures: this.consecutiveFailures,
    });
  }

  /**
   * Updates the harvest interval and restarts the scheduler to apply the new interval.
   * @param {number} newInterval - The new harvest interval in milliseconds
   * @returns {boolean} - True if interval was updated successfully, false otherwise
   */

  updateHarvestInterval(newInterval) {
    if (typeof newInterval !== "number" && isNaN(newInterval)) {
      Log.warn("Invalid newInterval provided to updateHarvestInterval");
      return;
    }

    if (newInterval < 1000 || newInterval > 300000) {
      Log.warn("newInterval out of bounds (1000-300000), ignoring");
      return;
    }

    // Check if the interval has actually changed to avoid unnecessary actions
    if (this.harvestCycle === newInterval) {
      return;
    }

    // 1. Update the harvestCycle property with the new interval
    this.harvestCycle = newInterval;
    Log.notice("Updated harvestCycle:", this.harvestCycle);

    // 2. Clear the existing timer
    if (this.currentTimerId) {
      clearTimeout(this.currentTimerId);
      this.currentTimerId = null;
    }

    // 3. Schedule a new timer with the updated interval
    if (this.isStarted) {
      this.scheduleNextHarvest();
    }

    return;
  }

  /**
   * Sets up page lifecycle event handlers.
   * @private
   */
  setupPageLifecycleHandlers() {
    let finalHarvestTriggered = false;

    const triggerFinalHarvest = () => {
      if (finalHarvestTriggered) return;
      finalHarvestTriggered = true;

      this.triggerHarvest({ isFinalHarvest: true, force: true });
    };

    // Handle page visibility changes
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) triggerFinalHarvest();
    });

    // Handle page unload
    window.addEventListener("pagehide", () => {
      triggerFinalHarvest();
    });

    // Handle beforeunload as backup
    window.addEventListener("beforeunload", () => {
      triggerFinalHarvest();
    });
  }
}
