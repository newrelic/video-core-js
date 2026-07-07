import pkg from "../package.json";
import Log from "./log";

/**
 * Builds the harvest URL with proper query parameters.
 * @returns {string} Harvest URL
 */

export function buildUrl(fallbackUrl) {
  try {
    if (!window.NRVIDEO || !window.NRVIDEO.info) {
      throw new Error("NRVIDEO info is not available.");
    }

    let { beacon, licenseKey, applicationID } = window.NRVIDEO.info;

    if (!beacon || !licenseKey)
      throw new Error(
        "Options object provided by New Relic is not correctly initialized"
      );

    if (applicationID) {
      return `https://${
        fallbackUrl ? fallbackUrl : beacon
      }/ins/1/${licenseKey}?a=${applicationID}&v=${pkg.version}&ref=${
        window.location.href
      }&ca=VA`;
    }

    return `https://${
      fallbackUrl ? fallbackUrl : beacon
    }/ins/1/${licenseKey}?&v=${pkg.version}&ref=${window.location.href}&ca=VA`;
  } catch (error) {
    console.error(error.message);
    return null; // Return null instead of undefined
  }
}

/**
 * Returns a function for use as a replacer parameter in JSON.stringify() to handle circular references.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Errors/Cyclic_object_value MDN - Cyclical object value}
 * @returns {Function} A function that filters out values it has seen before.
 */
const getCircularReplacer = () => {
  const seen = new WeakSet();
  return (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return;
      }
      seen.add(value);
    }
    return value;
  };
};

/**
 * The native JSON.stringify method augmented with a replacer function to handle circular references.
 * Circular references will be excluded from the JSON output rather than triggering errors.
 * @param {*} val - A value to be converted to a JSON string.
 * @returns {string} A JSON string representation of the value, with circular references handled.
 */
function stringify(val) {
  try {
    return JSON.stringify(val, getCircularReplacer()) ?? "";
  } catch (e) {
    Log.error("Error stringifying value:", e.message);
    return "";
  }
}

export function dataSize(data) {
  if (typeof data === "string" && data.length) return data.length;
  if (typeof data !== "object") return undefined;
  // eslint-disable-next-line
  if (
    typeof ArrayBuffer !== "undefined" &&
    data instanceof ArrayBuffer &&
    data.byteLength
  )
    return data.byteLength;
  if (typeof Blob !== "undefined" && data instanceof Blob && data.size)
    return data.size;
  if (typeof FormData !== "undefined" && data instanceof FormData)
    return undefined;

  try {
    return stringify(data).length;
  } catch (e) {
    return undefined;
  }
}

/**
 * Determines if a request should be retried based on HTTP status code
 * @param {number} status - HTTP status code
 * @returns {boolean} - True if request should be retried
 */
export function shouldRetry(status) {
  switch (status) {
    case 408: // Request Timeout
    case 429: // Too Many Requests
    case 500: // Internal Server Error
      return true;
    case 401: // Unauthorized - don't retry
    case 403: // Forbidden - don't retry
    case 404: // Not Found - don't retry
      return false;
  }
  // Retry for 5xx server errors and specific ranges
  return (status >= 502 && status <= 504) || (status >= 512 && status <= 530);
}

/**
 * Compresses a JSON payload using the Compression Streams API with Gzip.
 * see @description(https://developer.mozilla.org/en-US/docs/Web/API/Compression_Streams_API)
 * @param {object} payload - The JSON object to compress.
 * @returns {Promise<Blob>} A Promise that resolves with a Blob of the Gzipped data.
 */

export function compressPayload(payload) {
  const stringifiedPayload = JSON.stringify(payload);
  const stream = new Blob([stringifiedPayload]).stream();
  const compressionStream = new CompressionStream("gzip");
  const compressedStream = stream.pipeThrough(compressionStream);

  return new Response(compressedStream).blob();
}

/**
 * Decompresses a gzipped Blob back to a JSON object using the Compression Streams API.
 * @param {Blob|ArrayBuffer|Uint8Array} compressedData - The gzipped data to decompress.
 * @returns {Promise<object>} A Promise that resolves with the decompressed JSON object.
 */
export async function decompressPayload(compressedData) {
  try {
    // Convert different input types to a stream
    let stream;
    if (compressedData instanceof Blob) {
      stream = compressedData.stream();
    } else if (compressedData instanceof ArrayBuffer) {
      stream = new Blob([compressedData]).stream();
    } else if (compressedData instanceof Uint8Array) {
      stream = new Blob([compressedData]).stream();
    } else {
      throw new Error("Unsupported compressed data type");
    }

    // Decompress using DecompressionStream
    const decompressionStream = new DecompressionStream("gzip");
    const decompressedStream = stream.pipeThrough(decompressionStream);

    // Convert back to text
    const response = new Response(decompressedStream);
    const decompressedText = await response.text();

    // Parse JSON
    return JSON.parse(decompressedText);
  } catch (error) {
    throw new Error(`Failed to decompress payload: ${error.message}`);
  }
}

/**
 * Filters an object to include only the specified keys.
 * Creates a new object containing only the key-value pairs from the source object
 * that match the provided keys array.
 * @param {string[]} keys - Array of keys to extract from the object. If empty, null, or not an array, returns the original object.
 * @param {object} obj - The source object to extract entries from.
 * @returns {object} A new object containing only the entries that match the specified keys. Returns an empty object if obj is invalid.
 * @example
 * const data = { name: 'John', age: 30, city: 'NYC', country: 'USA' };
 * const filtered = getObjectEntriesForKeys(['name', 'city'], data);
 * // Returns: { name: 'John', city: 'NYC' }
 */
export function getObjectEntriesForKeys(keys, obj) {
    if(!keys || !Array.isArray(keys) || keys.length === 0) return obj;
    if(!obj || typeof obj !== 'object') return {};

    return keys.reduce((result, key) => {
        if(key in obj) {
            result[key] = obj[key];
        }
        return result;
    }, {});
}