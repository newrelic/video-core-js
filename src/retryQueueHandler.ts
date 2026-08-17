import Log from "./log";
import { dataSize } from "./utils";
import Constants from "./constants";
import { EventAttributes } from "./utils/eventBuilder";

const { MAX_PAYLOAD_SIZE, MAX_EVENTS_PER_BATCH } = Constants;

/**
 * Retry Queue Handler for managing failed events with retry logic,
 * backoff strategies, and persistent storage capabilities.
 */
export class RetryQueueHandler {
  retryQueue: EventAttributes[];
  maxQueueSize: number;
  maxQueueSizeBytes: number;

  constructor() {
    this.retryQueue = [];
    this.maxQueueSize = MAX_EVENTS_PER_BATCH; // Max 1000 events
    this.maxQueueSizeBytes = MAX_PAYLOAD_SIZE; // Max 1MB
  }

  /**
   * Adds failed events to the retry queue for retry processing.
   * @param {Array|object} events - Failed event(s) to add to retry queue
   */
  addFailedEvents(events: EventAttributes | EventAttributes[]): void {
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
        const eventSize = dataSize(event) ?? 0;
        while ((dataSize(this.retryQueue) ?? 0) + eventSize > this.maxQueueSizeBytes) {
          this.evictOldestEvent();
        }

        // Store event directly - no wrapper needed
        this.retryQueue.push({ ...event });
      }
    } catch (err: any) {
      Log.error("Failed to add events to retry queue:", err.message);
    }
  }

  /**
   * Discards an event that cannot be retried.
   * @param {object} event - Event to discard
   * @param {string} reason - Reason for discarding
   * @private
   */
  discardEvent(event: EventAttributes, reason: string): void {
    Log.warn(`Discarded event`, {
      reason,
      eventType: event.eventType,
    });
  }

  /**
   * Evicts the oldest event from the queue to make room.
   * @private
   */
  evictOldestEvent(): void {
    if (this.retryQueue.length > 0) {
      const oldest = this.retryQueue.shift();
      this.discardEvent(oldest as EventAttributes, "Queue full - evicted oldest");
    }
  }

  /**
   * For unified harvesting - get retry events that fit within payload limits
   * Removes the selected events from the retry queue since they're being retried
   * @param {number} availableSpace - Available payload space in bytes
   * @param {number} availableEventCount - Available event count
   * @returns {Array} Array of events that fit within limits
   */
  getRetryEventsToFit(availableSpace: number, availableEventCount: number): EventAttributes[] {
    const retryEvents: EventAttributes[] = [];
    let usedSpace = 0;
    let eventCount = 0;

    // Process retry queue in chronological order (oldest first) by iterating backwards
    // This allows us to remove elements immediately without index shifting issues
    for (let i = this.retryQueue.length - 1; i >= 0; i--) {
      const event = this.retryQueue[i]; // 1000

      if (eventCount >= availableEventCount) break;

      const eventSize = dataSize(event) ?? 0;
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
  getQueueSize(): number {
    return this.retryQueue.length;
  }

  /**
   * Clears the retry queue.
   */
  clear(): void {
    this.retryQueue = [];
  }
}

export default RetryQueueHandler;
