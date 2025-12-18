import Log from "./log";
import Constants from "./constants";
import { dataSize } from "./utils";

const { MAX_PAYLOAD_SIZE, MAX_EVENTS_PER_BATCH } = Constants;

/**
 * Enhanced event buffer that manages video events with unified priority handling
 * and automatic size management. All events are treated with equal priority
 * unless explicitly specified otherwise.
 */
export class NrVideoEventAggregator {
  constructor() {
    // Simplified to single priority queue for equal treatment

    this.buffer = [];
    this.maxPayloadSize = MAX_PAYLOAD_SIZE;
    this.maxEventsPerBatch = MAX_EVENTS_PER_BATCH;
    this.currentPayloadSize = 0;
    this.totalEvents = 0;

    // Dual threshold system - whichever is reached first triggers harvest
    // Payload size thresholds
    this.smartHarvestPayloadThreshold = Math.floor(this.maxPayloadSize * 0.6); // 60% of 1MB = 600KB
    this.overflowPayloadThreshold = Math.floor(this.maxPayloadSize * 0.9); // 90% of 1MB = 900KB

    // Event count thresholds
    this.smartHarvestEventThreshold = Math.floor(this.maxEventsPerBatch * 0.6); // 60% of 1000 = 600 events
    this.overflowEventThreshold = Math.floor(this.maxEventsPerBatch * 0.9); // 90% of 1000 = 900 events

    // Callback for triggering harvest
    this.onSmartHarvestTrigger = null;
  }

  /**
   * If an event with the specified actionName already exists in the buffer, it will be replaced.
   * Otherwise, the event will be added as a new entry.
   * @param {string} actionName - The actionName to search for in the buffer
   * @param {object} eventObject - The event object to add or use as replacement. Should contain an actionName property.
   * @returns {boolean} True if the operation succeeded, false if an error occurred
   */
  addOrReplaceByActionName(actionName, eventObject) {
      const i = this.buffer.findIndex(e => e.actionName === actionName);

      try {
          if(i === -1) {
              this.add(eventObject);
          } else {
              this.add(eventObject, i);
          }
          return true;
      } catch (error) {
          Log.error("Failed to set or replace the event to buffer:", error.message);
          return false;
      }
      return false;
    }

  /**
   * Adds an event to the unified buffer.
   * All events are treated equally in FIFO order.
   * @param {object} eventObject - The event to add
   * @param {number} index - index at which the event should be replaced with
   */
  add(eventObject, index) {
    try {
      // Calculate event payload size
      const eventSize = dataSize(eventObject);

      // Check if we need to make room based on EITHER payload size OR event count limits
      const wouldExceedPayload =
        this.currentPayloadSize + eventSize >= this.maxPayloadSize;
      const wouldExceedEventCount =
        this.totalEvents + 1 >= this.maxEventsPerBatch;

      if (wouldExceedPayload || wouldExceedEventCount) {
        this.makeRoom(eventSize);
      }

      if(index !== undefined && index !== null && index > -1) {
          // replace in unified buffer
          const previousPayloadSize = dataSize(this.buffer[index]);
          this.buffer[index] = eventObject;
          // Updating the payload size for the replaced event
          this.currentPayloadSize += eventSize - previousPayloadSize;
      } else {
          // Add to unified buffer
          this.buffer.push(eventObject);
          this.totalEvents++;
          this.currentPayloadSize += eventSize;
      }

      // Check if smart harvest should be triggered
      this.checkSmartHarvestTrigger();

      return true;
    } catch (error) {
      Log.error("Failed to add event to buffer:", error.message);
      return false;
    }
  }

  /**
   * Checks if smart harvest should be triggered based on dual threshold system.
   * Triggers when EITHER condition is met first:
   * - 60% of payload size (600KB) OR 60% of event count (600 events)
   * - 90% of payload size (900KB) OR 90% of event count (900 events)
   * @private
   */
  checkSmartHarvestTrigger() {
    const payloadPercentage = this.currentPayloadSize / this.maxPayloadSize;
    const eventPercentage = this.totalEvents / this.maxEventsPerBatch;

    // Check 90% emergency thresholds first (either payload OR event count)
    const isPayloadOverflowReached =
      this.currentPayloadSize >= this.overflowPayloadThreshold;
    const isEventOverflowReached =
      this.totalEvents >= this.overflowEventThreshold;

    if (isPayloadOverflowReached || isEventOverflowReached) {
      const triggerReason = isPayloadOverflowReached
        ? `payload ${this.currentPayloadSize}/${
            this.maxPayloadSize
          } bytes (${Math.round(payloadPercentage * 100)}%)`
        : `events ${this.totalEvents}/${this.maxEventsPerBatch} (${Math.round(
            eventPercentage * 100
          )}%)`;

      Log.warn(
        `OVERFLOW PREVENTION: ${triggerReason} - Emergency harvest triggered`
      );

      if (
        this.onSmartHarvestTrigger &&
        typeof this.onSmartHarvestTrigger === "function"
      ) {
        // Trigger immediate emergency harvest
        this.onSmartHarvestTrigger("overflow", 90);
      }
    }

    // Check 60% smart harvest thresholds (either payload OR event count)
    else {
      const isPayloadSmartReached =
        this.currentPayloadSize >= this.smartHarvestPayloadThreshold;
      const isEventSmartReached =
        this.totalEvents >= this.smartHarvestEventThreshold;

      if (isPayloadSmartReached || isEventSmartReached) {
        if (
          this.onSmartHarvestTrigger &&
          typeof this.onSmartHarvestTrigger === "function"
        ) {
          // Trigger proactive harvest
          this.onSmartHarvestTrigger("smart", 60);
        }
      }
    }
  }

  /**
   * Sets the callback function for smart harvest triggers.
   * @param {Function} callback - Function to call when smart harvest is triggered
   */
  setSmartHarvestCallback(callback) {
    this.onSmartHarvestTrigger = callback;
  }

  /**
   * Drains all events from the buffer in FIFO order (first in, first out).
   * No limits needed since buffer already manages size via makeRoom() and smart harvest triggers.
   * @returns {Array} Array of events in order they were added
   */
  drain() {
    try {
      // Drain ALL events - buffer size is already managed by makeRoom() and smart harvest
      const events = this.buffer.splice(0);

      // Reset counters since buffer is now empty
      this.totalEvents = 0;
      this.currentPayloadSize = 0;

      return events;
    } catch (error) {
      Log.error("Failed to drain events from buffer:", error.message);
      return [];
    }
  }

  /**
   * Checks if the buffer is empty.
   * @returns {boolean} True if all buffers are empty
   */
  isEmpty() {
    return this.totalEvents === 0;
  }

  /**
   * Gets the total number of events across all buffers.
   * @returns {number} Total event count
   */
  size() {
    return this.totalEvents;
  }

  /**
   * Clears the entire buffer.
   */
  clear() {
    this.buffer = [];
    this.totalEvents = 0;
  }

  /**
   * Makes room in the buffer by removing the oldest event.
   * Uses FIFO approach - removes the first (oldest) event.
   * @private
   */
  makeRoom(newEventSize) {
    // Before the while loop in makeRoom()
    if (newEventSize > this.maxPayloadSize) {
      Log.error("Event dropped: Event size exceeds maximum payload size.");
      return; // Exit the function to prevent infinite loop
    }

    // Keep a loop to evict events until we meet ALL conditions for the new event
    while (
      // Condition 1: Exceeding max event count
      this.totalEvents >= this.maxEventsPerBatch ||
      // Condition 2: Exceeding max payload size
      this.currentPayloadSize + newEventSize >= this.maxPayloadSize
    ) {
      if (this.buffer.length > 0) {
        const removed = this.buffer.shift(); // Remove the oldest event (FIFO)

        // Recalculate size and count after removal
        const removedSize = dataSize(removed);
        this.totalEvents--;
        this.currentPayloadSize -= removedSize;

        // Optional: Log a warning for a dropped event
        Log.warn("Event buffer full, oldest event removed.");
      } else {
        // Buffer is somehow empty, but conditions were met. Break the loop.
        break;
      }
    }
  }
}

export default NrVideoEventAggregator;
