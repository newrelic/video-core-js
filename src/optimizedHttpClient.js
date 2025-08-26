import { dataSize, shouldRetry } from "./utils";
import Log from "./log";

/**
 * Optimized HTTP client for video analytics data transmission with
 * performance monitoring and efficient request handling.
 */
export class OptimizedHttpClient {
  /**
   * Sends data to the specified URL with performance monitoring.
   * @param {object} requestOptions - Request configuration
   * @param {string} requestOptions.url - Target URL
   * @param {object} requestOptions.payload - Request payload
   * @param {object} requestOptions.options - Additional options
   * @param {Function} callback - Callback function for handling response
   * @returns {Promise<void>}
   */
  async send(requestOptions, callback) {
    const { url, payload, options = {} } = requestOptions;

    try {
      // Validate input
      if (!url || !payload) {
        throw new Error("URL and payload are required");
      }

      // Create request object
      const request = {
        url,
        payload,
        options,
        callback,
      };

      // Execute request immediately
      await this.executeRequest(request);
    } catch (error) {
      Log.error("Failed to send request:", error.message);
      callback({ retry: false, status: 0, error: error.message });
    }
  }

  /**
   * Executes an HTTP request with timeout and error handling.
   * @param {object} request - Request object
   * @private
   */
  async executeRequest(request) {
    const { url, payload, options, callback } = request;
    const startTime = Date.now();

    try {
      const requestBody = JSON.stringify(payload.body);

      // Handle final harvest with sendBeacon
      if (options.isFinalHarvest && navigator.sendBeacon) {
        const success = await this.sendWithBeacon(url, requestBody);
        const result = { success, status: success ? 204 : 0 };
        this.handleRequestComplete(request, result, startTime);
        return;
      }

      // Use fetch with timeout
      const response = await this.fetchWithTimeout(
        url,
        {
          method: "POST",
          body: requestBody,
          headers: {
            "Content-Type": "application/json",
          },
          keepalive: options.isFinalHarvest,
        },
        10000
      );

      const result = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };

      this.handleRequestComplete(request, result, startTime);
    } catch (error) {
      const result = {
        success: false,
        status: 0,
        error: error.message,
      };

      this.handleRequestComplete(request, result, startTime);
    }
  }

  /**
   * Handles request completion.
   * @param {object} request - Request object
   * @param {object} result - Request result
   * @param {number} startTime - Request start timestamp
   * @param {string} endpoint - The endpoint that was used for the request
   * @private
   */
  handleRequestComplete(request, result) {
    const { callback } = request;

    // Use smart retry logic based on HTTP status codes
    const shouldRetryRequest =
      !result.success &&
      (result.status === 0 || // Network/timeout errors
        shouldRetry(result.status)); // Smart status code-based retry

    callback({
      retry: shouldRetryRequest,
      status: result.status,
      error: result.error,
    });
  }

  /**
   * Sends data using navigator.sendBeacon for final harvests.
   * @param {string} url - Target URL
   * @param {string} body - Request body
   * @returns {Promise<boolean>} True if successful
   * @private
   */
  async sendWithBeacon(url, body) {
    try {
      return navigator.sendBeacon(url, body);
    } catch (error) {
      Log.warn("sendBeacon failed, falling back to fetch:", error.message);
      return false;
    }
  }

  /**
   * Fetch with timeout implementation.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/AbortController|MDN AbortController}
   * @param {string} url - Target URL
   * @param {object} options - Fetch options
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<Response>} Fetch response
   * @private
   */
  async fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}

export default OptimizedHttpClient;
