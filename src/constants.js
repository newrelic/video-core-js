/**
 * Constants for the library.
 * @class Constants
 * @static
 */
class Constants {}

/**
 * Enum for types/positions of ads.
 * @example var type = Constants.AdPositions.PRE
 * @enum {String}
 */
Constants.AdPositions = {
  /** For ads shown before the content. */
  PRE: "pre",
  /** For ads shown during the content. */
  MID: "mid",
  /** For ads shown after the content. */
  POST: "post",
};

// bam.nr-data.net
//bam-cell.nr-data.net

Constants.COLLECTOR = {
  US: ["bam.nr-data.net", "bam-cell.nr-data.net"],
  EU: "bam.eu01.nr-data.net",
  Staging: "staging-bam-cell.nr-data.net",
  GOV: "gov-bam.nr-data.net",
};

// ====== VALID EVENT TYPES ======
Constants.VALID_EVENT_TYPES = [
  "VideoAction",
  "VideoAdAction",
  "VideoErrorAction",
  "VideoCustomAction",
];

Constants.MAX_PAYLOAD_SIZE = 1048576; // 1MB = 1024 × 1024 bytes
Constants.MAX_BEACON_SIZE = 61440; // 60KB = 60 × 1024 bytes
Constants.MAX_EVENTS_PER_BATCH = 1000;
Constants.INTERVAL = 10000; //10 seconds

export default Constants;
