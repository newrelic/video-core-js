import { shouldRetry } from "./utils";
import Log from "./log";
import { applyObfuscationRules } from "./obfuscate";

export interface HttpRequestOptions {
  url: string;
  payload: { body: any };
  options?: { isFinalHarvest?: boolean };
}

export interface HttpResultCallback {
  (result: { retry?: boolean; status: number; statusText?: string; error?: string }): void;
}

interface InternalRequest {
  url: string;
  payload: { body: any };
  options: { isFinalHarvest?: boolean };
  callback: HttpResultCallback;
}

interface RequestResult {
  success: boolean;
  status: number;
  statusText?: string;
  error?: string;
}

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
  async send(requestOptions: HttpRequestOptions, callback: HttpResultCallback): Promise<void> {
    const { url, payload, options = {} } = requestOptions;

    try {
      // Validate input
      if (!url || !payload) {
        throw new Error("URL and payload are required");
      }

      // Create request object
      const request: InternalRequest = {
        url,
        payload,
        options,
        callback,
      };

      // Execute request immediately
      await this.executeRequest(request);
    } catch (error: any) {
      Log.error("Failed to send request:", error.message);
      callback({ retry: false, status: 0, error: error.message });
    }
  }

  /**
   * Executes an HTTP request with timeout and error handling.
   * @param {object} request - Request object
   * @private
   */
  async executeRequest(request: InternalRequest): Promise<void> {
    const { url, payload, options, callback } = request;
    const startTime = Date.now();

    try {
      const requestBody = applyObfuscationRules(
        JSON.stringify(payload.body),
        window.NRVIDEO?.config?.obfuscate
      );

      // Handle final harvest with sendBeacon
      if (options.isFinalHarvest && navigator.sendBeacon) {
        const success = await this.sendWithBeacon(url, requestBody);
        const result: RequestResult = { success, status: success ? 204 : 0 };
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

      const result: RequestResult = {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
      };

      this.handleRequestComplete(request, result, startTime);
    } catch (error: any) {
      const result: RequestResult = {
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
  handleRequestComplete(request: InternalRequest, result: RequestResult, startTime?: number): void {
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
  async sendWithBeacon(url: string, body: string): Promise<boolean> {
    try {
      return navigator.sendBeacon(url, body);
    } catch (error: any) {
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
  async fetchWithTimeout(url: string, options: RequestInit, timeout: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return response;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === "AbortError") {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      throw error;
    }
  }
}

export default OptimizedHttpClient;
