import Constants from "./constants.js";
import Harvest from "./harvest";

const { maxBatchSize, maxPayloadSize, idealPayloadSize } = Constants;

class EventBuffer extends Harvest {
  constructor(harvestInterval) {
    super();
    this._retryBuffer = [];
    this._eventBufferArray = [];
    this.harvestInterval = harvestInterval;
    this.originTime = null;
    this.isTimerRunning = false;
    this.startHarvestTimer();
  }

  setOriginTime(originTime) {
    this.originTime = originTime;
  }

  addEvent(eventType, attributes) {
    const payload = { eventType, ...attributes };
    this.generateAttributes(payload);

    if (!this.checkPayloadSize(payload)) {
      console.error(
        "Payload size exceeds ideal size, will not be considered for harvest",
        payload
      );
      return false; // Event not added due to size
    }

    this._eventBufferArray.push(payload);

    this.checkHarvestConditions();
    return true;
  }

  getBatch() {
    return [...this._eventBufferArray];
  }

  clearBatch() {
    this._eventBufferArray = [];
    this.isProcessing = false;
    this.clearTimer(); // Inherited from Harvest

    if (!this.isTimerRunning) {
      this.startHarvestTimer(); // Restart the timer after clearing the batch
    }
  }

  isEmpty() {
    return this._eventBufferArray.length === 0;
  }

  generateAttributes(data) {
    data["pageUrl"] = window.location.href;
    data["currentUrl"] = window.location.origin + window.location.pathname;
    data["referrerUrl"] = document.referrer;
    let eventRelativeTimeMs = 0;
    if (
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
    ) {
      eventRelativeTimeMs = performance.now();
    } else {
      eventRelativeTimeMs = Date.now() - this.originTime;
      console.warn(
        "performance.now() not available. Using Date.now() for relative time."
      );
    }
    data["timestamp"] = Math.floor(this.originTime + eventRelativeTimeMs);
    data["timeSinceLoad"] = eventRelativeTimeMs / 1000;
  }

  checkPayloadSize(payload) {
    if (this.getBufferSize(payload, "kb") >= idealPayloadSize) {
      console.warn(
        "Payload size exceeds ideal size, will not be considered for harvest",
        payload
      );
      return false; // Payload too large
    }
    return true; // Payload size is acceptable
  }

  checkHarvestConditions() {
    try {
      if (this.isRetrying && this.maxBufferSize(this._eventBufferArray)) {
        this._retryBuffer = [...this._eventBufferArray, ...this._retryBuffer];
      }

      if (
        this._eventBufferArray.length >= maxBatchSize ||
        this.maxBufferSize(this._eventBufferArray)
      ) {
        const batchToSend = this.getBatch();
        this.sendBatch(batchToSend);
        this.clearBatch();
      }
    } catch (error) {
      this.handleError(error, "checkHarvestConditions", this._eventBufferArray);
    }
  }

  maxBufferSize(payload) {
    if (this.getBufferSize(payload, "mb") >= maxPayloadSize) {
      return true;
    }
    return false;
  }

  getBufferSize(payload, format) {
    const jsonString = JSON.stringify(payload);
    const sizeInBytes = new TextEncoder().encode(jsonString).length;
    if (format === "kb") {
      return sizeInBytes / 1024;
    } else if (format === "mb") {
      return sizeInBytes / (1024 * 1024);
    }
  }

  startHarvestTimer() {
    if (this.isTimerRunning) {
      return;
    }

    this.clearTimer(); // Inherited from Harvest
    this.isTimerRunning = true;

    this.timerId = setTimeout(() => {
      this.isTimerRunning = false; // Mark timer as completed

      if (!this.isEmpty()) {
        const batchToSend = this.getBatch();

        this.sendBatch(batchToSend);
        this.clearBatch();
      } else {
        this.clearBatch();
      }
    }, this.harvestInterval);
  }

  clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
      this.isTimerRunning = false;
    }
  }

  destroy() {
    this.clearTimer();
    this._eventBufferArray = [];
    this._retryBuffer = [];
    // Call parent destroy if it exists
    if (super.destroy) {
      super.destroy();
    }
  }
}

export default EventBuffer;
