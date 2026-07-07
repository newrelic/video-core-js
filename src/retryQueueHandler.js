import Log from "./log";
import { dataSize } from "./utils";
import Constants from "./constants";

const { MAX_PAYLOAD_SIZE, MAX_EVENTS_PER_BATCH } = Constants;

/**
 * Retry Queue Handler for managing failed events with retry logic,
 * backoff strategies, and persistent storage capabilities.
 */
export class RetryQueueHandler {
  constructor() {
    this.retryQueue = [];
    this.maxQueueSize = MAX_EVENTS_PER_BATCH; // Max 1000 events
    this.maxQueueSizeBytes = MAX_PAYLOAD_SIZE; // Max 1MB
  }

  /**
   * Adds failed events to the retry queue for retry processing.
   * @param {Array|object} events - Failed event(s) to add to retry queue
   */
  addFailedEvents(events) {
    try {
      const eventsArray = Array.isArray(events) ? events : [events];

      Log.notice(`Adding ${eventsArray.length} failed events to retry queue`, {
        queueSizeBefore: this.retryQueue.length,
      });

      for (const event of eventsArray) {
        // Check queue size and make room if necessary
        if (this.retryQueue.length >= this.maxQueueSize) {
          this.evictOldestEvent();
        }

        // Check queue memory size and make room if necessary
        const eventSize = dataSize(event);
        while (dataSize(this.retryQueue) + eventSize > this.maxQueueSizeBytes) {
          this.evictOldestEvent();
        }

        // Store event directly - no wrapper needed
        this.retryQueue.push({ ...event });
      }
    } catch (err) {
      Log.error("Failed to add events to retry queue:", err.message);
    }
  }

  /**
   * Discards an event that cannot be retried.
   * @param {object} event - Event to discard
   * @param {string} reason - Reason for discarding
   * @private
   */
  discardEvent(event, reason) {
    Log.warn(`Discarded event`, {
      reason,
      eventType: event.eventType,
    });
  }

  /**
   * Evicts the oldest event from the queue to make room.
   * @private
   */
  evictOldestEvent() {
    if (this.retryQueue.length > 0) {
      const oldest = this.retryQueue.shift();
      this.discardEvent(oldest, "Queue full - evicted oldest");
    }
  }

  /**
   * For unified harvesting - get retry events that fit within payload limits
   * Removes the selected events from the retry queue since they're being retried
   * @param {number} availableSpace - Available payload space in bytes
   * @param {number} availableEventCount - Available event count
   * @returns {Array} Array of events that fit within limits
   */
  getRetryEventsToFit(availableSpace, availableEventCount) {
    const retryEvents = [];
    let usedSpace = 0;
    let eventCount = 0;

    // Process retry queue in chronological order (oldest first) by iterating backwards
    // This allows us to remove elements immediately without index shifting issues
    for (let i = this.retryQueue.length - 1; i >= 0; i--) {
      const event = this.retryQueue[i]; // 1000

      if (eventCount >= availableEventCount) break;

      const eventSize = dataSize(event);
      if (usedSpace + eventSize > availableSpace) break;

      // Add to beginning of retryEvents to maintain chronological order (oldest first)
      retryEvents.unshift(event);
      usedSpace += eventSize;
      eventCount++;

      // Remove immediately - safe because we're iterating backwards
      this.retryQueue.splice(i, 1);
    }

    return retryEvents;
  }

  /**
   * Gets the current retry queue size.
   * @returns {number} Queue size
   */
  getQueueSize() {
    return this.retryQueue.length;
  }

  /**
   * Clears the retry queue.
   */
  clear() {
    this.retryQueue = [];
  }
}

export default RetryQueueHandler;
