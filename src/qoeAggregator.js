import Log from "./log";

/**
 * Quality of Experience (QoE) KPI Aggregator
 *
 * DESIGN:
 * This class is a single-responsibility aggregator that computes QoE KPIs by
 * reading from the existing event pipeline's fully-assembled attributes.
 * It does NOT maintain parallel state — the tracker's timeSince table, bitrate
 * getters, and playtime counters already compute the raw values. This class
 * simply observes them at each content event via processAction().
 *
 * HOW IT WORKS:
 * 1. VideoTracker calls processAction(action, attributes, isPlaying) for
 *    every CONTENT_* event, AFTER all attributes (timeSince, bitrate, playtime)
 *    are fully assembled.
 * 2. The aggregator extracts relevant values from the attributes dictionary:
 *    - timeSinceRequested, pre-roll ad wall-clock time → startup time
 *    - contentBitrate → peak + time-weighted average
 *    - timeSinceBufferBegin → rebuffering time (all post-initial buffers)
 *    - totalPlaytime → latest playtime for ratio calculation
 * 3. On demand (harvest cycle), generateAggregateAttributes() returns the
 *    computed KPI dictionary, which is sent as a QOE_AGGREGATE event.
 * 4. reset() clears all state for the next video session.
 *
 * KPIs PRODUCED:
 * - startupTime           Time from request to start, minus pre-roll ad wall-clock time (ms)
 * - peakBitrate           Highest observed bitrate during playback (bps)
 * - averageBitrate        Time-weighted average bitrate (bps)
 * - totalPlaytime         Total content playtime (ms)
 * - totalRebufferingTime  Total rebuffering time, excludes initial buffer (ms)
 * - rebufferingRatio      (rebufferingTime / playtime) * 100 (percentage)
 * - hadStartupError       Error occurred before content started
 * - hadPlaybackError      Error occurred after content started
 */

/** Centralized list of all QoE KPI attribute keys. */
export const QOE_KPI_KEYS = [
  "startupTime",
  "peakBitrate",
  "averageBitrate",
  "totalPlaytime",
  "totalRebufferingTime",
  "rebufferingRatio",
  "hadStartupError",
  "hadPlaybackError",
];

export class QoEAggregator {
  constructor() {
    this.reset();
  }

  /**
   * Reset all QoE state for the next video session.
   * Called after CONTENT_END once the final aggregate has been sent.
   */
  reset() {
    // Lifecycle flags
    this._hasReceivedRequest = false;
    this._hasReceivedStart = false;

    // Startup
    this._startupTime = null;

    // Pre-roll ad wall-clock time (sum of timeSinceAdStarted for ads before CONTENT_START)
    this._prerollAdWallClockTime = 0; // ms

    // Bitrate tracking (time-weighted average)
    // All timestamps in ms (Date.now()).
    this._peakBitrate = 0;
    this._currentBitrate = 0;
    this._lastBitrateChangeTimestamp = 0; // ms
    this._bitrateWeightedSum = 0;
    this._bitrateTotalDuration = 0; // ms

    // Rebuffering
    this._totalRebufferingTime = 0;
    this._hasSkippedFirstBuffer = false;

    // Error flags
    this._hadStartupError = false;
    this._hadPlaybackError = false;

    // Playtime — real-time computation at harvest time
    this._lastTotalPlaytime = 0;
    this._lastPlaytimeUpdateTimestamp = 0; // ms (Date.now())
    this._isPlaying = false;

    // Dirty check — snapshot of last-sent KPIs to avoid redundant events
    this._lastSentSnapshot = null;
  }

  /**
   * Process an ad event to accumulate wall-clock time of pre-roll ads.
   * Reads timeSinceAdStarted from the enriched attributes at AD_END.
   *
   * @param {string} event The ad event name (e.g. AD_START, AD_END)
   * @param {object} attributes The enriched attributes dictionary
   */
  processAdEvent(event, attributes) {
    // Only track ads before content starts (pre-roll)
    if (this._hasReceivedStart) return;

    if (event === "AD_END") {
      const adDuration = attributes.timeSinceAdStarted || 0;
      if (adDuration > 0) {
        this._prerollAdWallClockTime += adDuration;
      }
    }
  }

  /**
   * Process a content event action and its fully-assembled attributes.
   * Called from VideoTracker for every CONTENT_* event AFTER all attributes
   * (timeSince, bitrate, playtime, etc.) are fully assembled.
   *
   * @param {string} action The content action name (e.g. CONTENT_START)
   * @param {object} attributes The fully-processed attributes dictionary
   * @param {boolean} isPlaying Whether the player is currently in a playing state
   */
  processAction(action, attributes, isPlaying) {
    // Always grab the latest totalPlaytime and record when we got it
    if (attributes.totalPlaytime !== undefined) {
      this._lastTotalPlaytime = attributes.totalPlaytime;
      this._lastPlaytimeUpdateTimestamp = Date.now();
    }
    this._isPlaying = isPlaying;

    // Pause/resume bitrate timer based on play state transitions
    const timerRunning = this._lastBitrateChangeTimestamp > 0;
    if (timerRunning && !isPlaying) {
      this._pauseBitrateTimer();
    } else if (!timerRunning && isPlaying) {
      this._resumeBitrateTimer();
    }

    // Track bitrate from every content event
    this._updateBitrateFromAttributes(attributes);

    // Action-specific handling
    switch (action) {
      case "CONTENT_REQUEST":
        this._handleRequest();
        break;
      case "CONTENT_START":
        this._handleStart(attributes);
        break;
      case "CONTENT_BUFFER_END":
        this._handleBufferEnd(attributes);
        break;
      case "CONTENT_ERROR":
        this._handleError();
        break;
      case "CONTENT_END":
        this._flushBitrateSegment();
        break;
    }
  }

  /**
   * Generate the QoE aggregate attributes dictionary.
   * Includes the current in-progress bitrate segment in the average calculation
   * so that intermediate reports (during playback) are accurate.
   *
   * Performs a dirty check: if the computed KPIs are identical to the last-sent
   * snapshot, returns null to avoid redundant events. Pass force=true to bypass
   * (e.g. for the final CONTENT_END aggregate).
   *
   * @param {object} [options]
   * @param {boolean} [options.force=false] Bypass the dirty check
   * @returns {object|null} Dictionary of KPI attributes, or null if no session / not dirty.
   */
  generateAggregateAttributes({ force = false } = {}) {
    if (!this._hasReceivedRequest) {
      return null;
    }

    const attrs = {};

    // Startup time (ms)
    if (this._startupTime !== null) {
      attrs.startupTime = this._startupTime;
    }

    // Peak bitrate (bps)
    if (this._peakBitrate > 0) {
      attrs.peakBitrate = this._peakBitrate;
    }

    // Time-weighted average bitrate (bps)
    const avgBitrate = this._computeAverageBitrate();
    if (avgBitrate !== null) {
      attrs.averageBitrate = avgBitrate;
    }

    // Real-time totalPlaytime (ms)
    const totalPlaytime = this._computeRealTimePlaytime();

    // Rebuffering
    attrs.totalRebufferingTime = this._totalRebufferingTime;
    attrs.totalPlaytime = totalPlaytime;

    if (totalPlaytime > 0) {
      attrs.rebufferingRatio =
        (this._totalRebufferingTime / totalPlaytime) * 100;
    } else {
      attrs.rebufferingRatio = 0;
    }

    // Error flags
    attrs.hadStartupError = this._hadStartupError;
    attrs.hadPlaybackError = this._hadPlaybackError;

    // Dirty check: skip if KPIs haven't changed since last send
    if (!force && this._lastSentSnapshot !== null) {
      if (this._snapshotsEqual(attrs, this._lastSentSnapshot)) {
        return null;
      }
    }

    // Save snapshot for next dirty check
    this._lastSentSnapshot = { ...attrs };

    return attrs;
  }

  /**
   * Compute time-weighted average bitrate including the current in-progress segment.
   * @returns {number|null} Rounded average bitrate in bps, or null if no data.
   * @private
   */
  _computeAverageBitrate() {
    let weightedSum = this._bitrateWeightedSum;
    let totalDuration = this._bitrateTotalDuration;

    // Include the current in-progress segment so intermediate reports are accurate
    if (this._currentBitrate > 0 && this._lastBitrateChangeTimestamp > 0) {
      const segmentDuration = Date.now() - this._lastBitrateChangeTimestamp;
      if (segmentDuration > 0) {
        weightedSum += this._currentBitrate * segmentDuration;
        totalDuration += segmentDuration;
      }
    }

    return totalDuration > 0 ? Math.round(weightedSum / totalDuration) : null;
  }

  /**
   * Compute real-time totalPlaytime by adding elapsed time since the last event
   * if the player is currently playing.
   * @returns {number} Total playtime in ms.
   * @private
   */
  _computeRealTimePlaytime() {
    let totalPlaytime = this._lastTotalPlaytime;
    if (this._isPlaying && this._lastPlaytimeUpdateTimestamp > 0) {
      const elapsed = Date.now() - this._lastPlaytimeUpdateTimestamp;
      if (elapsed > 0) {
        totalPlaytime += Math.round(elapsed);
      }
    }
    return totalPlaytime;
  }

  /**
   * Compare two KPI snapshots for equality.
   * @private
   */
  _snapshotsEqual(a, b) {
    for (const key of QOE_KPI_KEYS) {
      if (a[key] !== b[key]) return false;
    }
    return true;
  }

  // --- Private handlers ---

  _handleRequest() {
    this._hasReceivedRequest = true;
  }

  _handleStart(attributes) {
    this._hasReceivedStart = true;

    // Startup time = timeSinceRequested - preroll ad wall-clock time
    const timeSinceRequested = attributes.timeSinceRequested;
    if (timeSinceRequested !== undefined && timeSinceRequested !== null) {
      let startup = timeSinceRequested;
      startup -= this._prerollAdWallClockTime;
      this._startupTime = Math.max(startup, 0);
    }

    // Set baseline timestamp for first bitrate segment
    if (this._lastBitrateChangeTimestamp === 0) {
      this._lastBitrateChangeTimestamp = Date.now();
    }
  }

  _handleBufferEnd(attributes) {
    // Skip the first buffer event in the session (initial load)
    if (!this._hasSkippedFirstBuffer) {
      this._hasSkippedFirstBuffer = true;
      return;
    }

    // All subsequent buffer events count as rebuffering
    const timeSinceBufferBegin = attributes.timeSinceBufferBegin;
    if (timeSinceBufferBegin !== undefined && timeSinceBufferBegin !== null) {
      this._totalRebufferingTime += timeSinceBufferBegin;
    }
  }

  _handleError() {
    if (this._hasReceivedStart) {
      this._hadPlaybackError = true;
    } else {
      this._hadStartupError = true;
    }
  }

  // --- Bitrate tracking ---

  /**
   * TIME-WEIGHTED AVERAGE BITRATE ALGORITHM:
   *
   * We track bitrate as a series of segments. Each segment has a bitrate and duration.
   * When bitrate changes, we "close" the previous segment by adding
   * (previousBitrate * segmentDuration) to the weighted sum.
   *
   * All timestamps are in ms (Date.now()). Since both numerator and denominator
   * use the same time unit, the weighted average produces the correct bps value.
   *
   * Example: 2Mbps for 10000ms, then 4Mbps for 20000ms
   *   → avg = (2M*10000 + 4M*20000) / 30000 = 3.33 Mbps
   *
   * The current in-progress segment is NOT accumulated here — it's included
   * on-the-fly in _computeAverageBitrate() so intermediate reports stay accurate.
   *
   * On CONTENT_END, _flushBitrateSegment closes the final segment.
   */
  _updateBitrateFromAttributes(attributes) {
    const bitrate = attributes.contentBitrate || attributes.contentRenditionBitrate;
    if (!bitrate || typeof bitrate !== "number" || bitrate <= 0) {
      return;
    }

    // Track highest bitrate seen
    if (bitrate > this._peakBitrate) {
      this._peakBitrate = bitrate;
    }

    // When bitrate changes, close the previous segment and start a new one
    if (
      bitrate !== this._currentBitrate &&
      this._currentBitrate > 0 &&
      this._lastBitrateChangeTimestamp > 0
    ) {
      const now = Date.now();
      const segmentDuration = now - this._lastBitrateChangeTimestamp;
      if (segmentDuration > 0) {
        this._bitrateWeightedSum +=
          this._currentBitrate * segmentDuration;
        this._bitrateTotalDuration += segmentDuration;
      }
      this._lastBitrateChangeTimestamp = now;
    }

    // Initialize baseline on first bitrate observation
    if (this._currentBitrate === 0 && this._lastBitrateChangeTimestamp === 0) {
      this._lastBitrateChangeTimestamp = Date.now();
    }

    this._currentBitrate = bitrate;
  }

  /** Close the final bitrate segment at CONTENT_END. */
  _flushBitrateSegment() {
    if (this._currentBitrate > 0 && this._lastBitrateChangeTimestamp > 0) {
      const now = Date.now();
      const segmentDuration = now - this._lastBitrateChangeTimestamp;
      if (segmentDuration > 0) {
        this._bitrateWeightedSum +=
          this._currentBitrate * segmentDuration;
        this._bitrateTotalDuration += segmentDuration;
      }
      this._lastBitrateChangeTimestamp = now;
    }
  }

  /** Close current bitrate segment and stop the timer (playing → non-play). */
  _pauseBitrateTimer() {
    if (this._currentBitrate > 0 && this._lastBitrateChangeTimestamp > 0) {
      const now = Date.now();
      const segmentDuration = now - this._lastBitrateChangeTimestamp;
      if (segmentDuration > 0) {
        this._bitrateWeightedSum +=
          this._currentBitrate * segmentDuration;
        this._bitrateTotalDuration += segmentDuration;
      }
    }
    this._lastBitrateChangeTimestamp = 0;
  }

  /** Restart the bitrate timer (non-play → playing). */
  _resumeBitrateTimer() {
    this._lastBitrateChangeTimestamp = Date.now();
  }
}

export default QoEAggregator;
