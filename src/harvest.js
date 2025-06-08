import Constants from "./constants.js";

const { maxPayloadSize } = Constants;

class Harvest {
  constructor() {
    this.timerId = null;
    this.isRetrying = false;
    this.errorCallback = null;
    this.lastError = null;
  }

  onError(callback) {
    this.errorCallback = callback;
  }

  handleError(error, context, batchData = null) {
    this.lastError = {
      error,
      context,
      timestamp: Date.now(),
      batchData: batchData ? [...batchData] : null,
    };

    console.error(`Error in ${context}:`, error);

    // Call user-defined error callback if available
    if (this.errorCallback && typeof this.errorCallback === "function") {
      try {
        this.errorCallback(this.lastError);
      } catch (callbackError) {
        console.error("Error in error callback:", callbackError);
      }
    }
  }

  buildApiEndPoint() {
    const { applicationID, beacon, licenseKey, sa } = window.NRMS.info;

    const params = new URLSearchParams({
      a: applicationID,
      sa: sa,
      v: "1.278.1",
      t: "Unnamed Transaction",
      rst: "31397",
      ck: "0",
      s: "99b3a13c953f17d2",
      ref: window.location.href, // URLSearchParams automatically encodes
      ptid: "22ff3d83b3d51681",
    });

    return `https://${encodeURIComponent(beacon)}/ins/1/${encodeURIComponent(
      licenseKey
    )}?${params.toString()}`;
  }

  sendBatch(batch) {
    if (!Array.isArray(batch) || batch.length === 0) {
      this.handleError(new Error("Invalid batch data"), "sendBatch");
      return;
    }

    // let { applicationID, beacon, licenseKey, sa } = window.NRMS.info;
    // const apiEndPoint = `https://${beacon}/ins/1/${licenseKey}?a=${applicationID}&sa=${sa}&v=1.278.1&t=Unnamed%20Transaction&rst=31397&ck=0&s=99b3a13c953f17d2&ref=${window.location.href}&ptid=22ff3d83b3d51681`;

    const apiEndPoint = this.buildApiEndPoint();

    let batchData = [...batch];

    /* not full implementation  */
    if (!this.isRetrying && this._retryBuffer.length > 0) {
      const currentBatchSize = this.getBufferSize(batch, "mb");
      const remainingSize = maxPayloadSize - currentBatchSize;

      if (remainingSize > 0) {
        let totalRetrySize = 0;
        let retryItemsToAdd = [];

        // calculate how may retry items we can fit
        for (let i = 0; i < this._retryBuffer.length; i++) {
          const item = this._retryBuffer[i];
          const itemSize = this.getBufferSize(item, "mb");
          if (totalRetrySize + itemSize <= remainingSize) {
            totalRetrySize += itemSize;
            retryItemsToAdd.push(item);
          } else {
            break; // No more items can fit
          }
        }
      }

      // Remove the items we're adding from retry buffer and add to batch
      if (retryItemsToAdd.length > 0) {
        this._retryBuffer.splice(0, retryItemsToAdd.length);
        batchData = [...retryItemsToAdd, ...batch];
      }
    }

    this.callApi(apiEndPoint, batch)
      .then((response) => {
        console.log("response", response);
        if (response.status === 204) {
          this.batchData = [];
          this.isRetrying = false; // Reset retry state on successful send
          this.lastError = null;
        } else if (this.shouldRetry(response.status)) {
          this.isRetrying = true;
          // upto 1mb data will be stored under this._eventBufferArray
          this._eventBufferArray = [...batchData, ...this._eventBufferArray]; // Store the batch data for retry
        } else {
          throw new Error(`Unexpected response status: ${response.status}`);
        }
      })
      .catch((error) => {
        console.error("Error sending batch", error);
      });
  }

  async callApi(apiEndPoint, data) {
    try {
      const response = await fetch(apiEndPoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
      });

      return response;
    } catch (error) {
      throw error;
    }
  }

  shouldRetry(status) {
    switch (status) {
      case 408:
      case 429:
      case 500:
        return true;
    }
    return (status >= 502 && status <= 504) || (status >= 512 && status <= 530);
  }

  clearTimer() {
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    } else {
    }
  }

  destroy() {
    this.clearTimer();
  }
}

export default Harvest;
