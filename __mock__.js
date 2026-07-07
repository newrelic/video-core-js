/**
 * Jest Mock for @newrelic/video-core
 *
 * WHY THIS EXISTS:
 * ----------------
 * @newrelic/video-core ships as a pre-built, minified webpack bundle (dist/cjs/index.js).
 * Jest cannot properly transform minified bundles, even with transformIgnorePatterns configured.
 * This causes "Super expression must either be null or a function" errors when running Jest tests
 * in video agent repositories that depend on video-core.
 *
 * HOW TO USE:
 * -----------
 * In your Jest configuration (jest.config.js), add:
 *
 * ```javascript
 * module.exports = {
 *   moduleNameMapper: {
 *     "^@newrelic/video-core$": "@newrelic/video-core/__mock__.js"
 *   }
 * };
 * ```
 *
 * IMPORTANT:
 * ----------
 * - This mock is ONLY for testing purposes
 * - It provides the minimal interface needed for Jest-based unit tests
 * - It is NOT included in the built dist/ bundles
 * - Function stubs are intentionally simple (no jest.fn() or sinon) to remain framework-agnostic
 * - Consumer tests can override these stubs with their own mocks/spies as needed
 */

const nrvideo = {
  /**
   * Base VideoTracker class
   * Provides the minimal interface that video trackers extend from
   */
  VideoTracker: class VideoTracker {
    constructor(player, options) {
      this.player = player;
      this.options = options;
      this.tag = player;
    }

    // Event sending methods (stubbed for testing)
    sendDownload() {}
    sendRequest() {}
    sendBufferStart() {}
    sendBufferEnd() {}
    sendResume() {}
    sendStart() {}
    sendPause() {}
    sendSeekStart() {}
    sendSeekEnd() {}
    sendError() {}
    sendEnd() {}
    sendAdClick() {}
    sendAdQuartile() {}
    sendRenditionChanged() {}
    setAdsTracker() {}
    getTrackerVersion() { return '1.0.0'; }
  },

  /**
   * Core module
   * Handles tracker registration and management
   */
  Core: {
    addTracker: function() {}
  },

  /**
   * Log module
   * Handles debug logging
   */
  Log: {
    debugCommonVideoEvents: function() {}
  }
};

// Export as default for ES6 import compatibility
module.exports = nrvideo;
module.exports.default = nrvideo;
