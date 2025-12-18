import Chrono from "./chrono";
import Log from "./log";

/**
 * State machine for a VideoTracker and its monitored video.
 */
class VideoTrackerState {
  /** Constructor */
  constructor() {
    this.reset();

    //this.setupNetworkListeners();

    /**
     * Time when the VideoTrackerState was initializated.
     * @private
     */
    this._createdAt = Date.now();
    this._hb = true;
    this._acc = 0;
    this._bufferAcc = 0;
  }

  /** Resets all flags and chronos. */
  reset() {
    /**
     * Unique identifier of the view.
     * @private
     */
    this._viewSession = null;

    /**
     * Number of views seen.
     * @private
     */
    this._viewCount = 0;

    /**
     * True if it is tracking ads.
     * @private
     */
    this._isAd = false;

    /**
     * Number of errors fired. 'End' resets it.
     */
    this.numberOfErrors = 0;

    /**
     * Number of ads shown.
     */
    this.numberOfAds = 0;

    /**
     * Number of videos played.
     */
    this.numberOfVideos = 0;

    /**
     * The amount of ms the user has been watching content (not paused, not buffering, not ads...)
     */
    this.totalPlaytime = 0;

    this.weightedAverageBitrate = 0;

    /**
     * The amount of ms the user has been watching ads during an ad break.
     */
    this.totalAdPlaytime = 0;

    /** True if you are in the middle of an ad break. */
    this.isAdBreak = false;

    /** True if initial buffering event already happened. */
    this.initialBufferingHappened = false;

    /**
     * New QoE KPIs - Content only
     */

    /**
     * Startup Time: Time from CONTENT_REQUEST to CONTENT_START in milliseconds.
     */
    this.startupTime = null;

    /**
     * Peak Bitrate: Maximum contentBitrate observed across all content playback.
     */
    this.peakBitrate = 0;

    /**
     * Last tracked bitrate
     */
    this._lastBitrate = null;

    /**
     * total bitrate partial value for average weighted average bitrate
     */
    this.partialAverageBitrate = 0;

    /**
     * Had Startup Failure: TRUE if CONTENT_ERROR occurs before CONTENT_START.
     */
    this.hadStartupFailure = false;

    /**
     * Had Playback Failure: TRUE if CONTENT_ERROR occurs during content playback.
     */
    this.hadPlaybackFailure = false;

    /**
     * The amount of ms the user has been rebuffering during content playback.
     */
    this.totalRebufferingTime = 0;

    this.resetFlags();
    this.resetChronos();
  }

  /** Resets flags. */
  resetFlags() {
    /** True once the player has finished loading. */
    this.isPlayerReady = false;

    /** True if the video has been user-requested to play. ie: user cicks play. */
    this.isRequested = false;

    /** True if the video has starting playing. ie: actual images/audio showing in screen. */
    this.isStarted = false;

    /** True if the video is paused. */
    this.isPaused = false;

    /** True if the video is performing a seek action. */
    this.isSeeking = false;

    /** True if the video is currently buffering. */
    this.isBuffering = false;

    /** True if the video is currently playing (not buffering, not paused...) */
    this.isPlaying = false;
  }

  /** Resets chronos. */
  resetChronos() {
    /** Chrono that counts time since last requested event. */
    this.timeSinceRequested = new Chrono();

    /** Chrono that counts time since last start event. */
    this.timeSinceStarted = new Chrono();

    /** Chrono that counts time since last pause event. */
    this.timeSincePaused = new Chrono();

    /** Chrono that counts time since last seeking start event. */
    this.timeSinceSeekBegin = new Chrono();

    /** Chrono that counts time since last buffering start event. */
    this.timeSinceBufferBegin = new Chrono();

    /** Chrono that counts time since last ad break start event. */
    this.timeSinceAdBreakStart = new Chrono();

    /** Chrono that counts time since last download event. */
    this.timeSinceLastDownload = new Chrono();

    /** Chrono that counts time since last heartbeat. */
    this.timeSinceLastHeartbeat = new Chrono();

    /** Chrono that counts time since last rendition change. */
    this.timeSinceLastRenditionChange = new Chrono();

    /** Ads only. Chrono that counts time since last ad quartile. */
    this.timeSinceLastAdQuartile = new Chrono();

    /** Content only. Chrono that counts time since last AD_END. */
    this.timeSinceLastAd = new Chrono();

    /** Chrono that counts time since last error event. */
    this.timeSinceLastError = new Chrono();

    /** Chrono that counts time since last ad error event. */
    this.timeSinceLastAdError = new Chrono();

    /** Chrono that counts time since last *_RESUME. Only for buffering events. */
    this.timeSinceResumed = new Chrono();

    /** Chrono that counts time since last *_SEEK_END. Only for buffering events. */
    this.timeSinceSeekEnd = new Chrono();

    /** Chrono that counts the ammount of time the video have been playing since the last event. */
    this.playtimeSinceLastEvent = new Chrono();

    /** A dictionary containing the custom timeSince attributes. */
    this.customTimeSinceAttributes = {};

    /** This are used to collect the time of buffered and pause resume between two heartbeats */
    this.elapsedTime = new Chrono();
    this.bufferElapsedTime = new Chrono();

    /** tracks total ad play time  */
    this._totalAdPlaytime = new Chrono();
  }

  /** Returns true if the tracker is currently on ads. */
  isAd() {
    return this._isAd;
  }

  /** Sets if the tracker is currenlty tracking ads */
  setIsAd(isAd) {
    this._isAd = isAd;
  }

  /**
   * Set the Chrono for the custom attribute
   *
   * @param {object} name Time since attribute name.
   */
  setTimeSinceAttribute(name) {
    this.customTimeSinceAttributes[name] = new Chrono();
    this.customTimeSinceAttributes[name].start();
  }

  /**
   * Delete a time since attribute
   *
   * @param {object} name Time since attribute name.
   */
  removeTimeSinceAttribute(name) {
    delete this.customTimeSinceAttributes[name];
  }

  /**
   * Returns a random-generated view Session ID, useful to sort by views.
   */
  getViewSession() {
    if (!this._viewSession) {
      let time = new Date().getTime();
      let random =
        Math.random().toString(36).substring(2) +
        Math.random().toString(36).substring(2);

      this._viewSession = time + "-" + random;
    }

    return this._viewSession;
  }

  /**
   * Returns a random-generated view Session ID, plus a view count, allowing you to distinguish
   * between two videos played in the same session.
   */
  getViewId() {
    return this.getViewSession() + "-" + this._viewCount;
  }

  /**
   * Fills given object with state-based attributes.
   *
   * @param {object} att Collection fo key value attributes
   * @return {object} Filled attributes
   */
  getStateAttributes(att) {
    att = att || {};

    if (this.isAd()) {
      // Ads only
      if (this.isRequested) {
        att.timeSinceAdRequested = this.timeSinceRequested.getDeltaTime();
        att.timeSinceLastAdHeartbeat =
          this.timeSinceLastHeartbeat.getDeltaTime();
      }
      if (this.isStarted)
        att.timeSinceAdStarted = this.timeSinceStarted.getDeltaTime();
      if (this.isPaused)
        att.timeSinceAdPaused = this.timeSincePaused.getDeltaTime();
      if (this.isBuffering)
        att.timeSinceAdBufferBegin = this.timeSinceBufferBegin.getDeltaTime();
      if (this.isSeeking)
        att.timeSinceAdSeekBegin = this.timeSinceSeekBegin.getDeltaTime();
      if (this.isAdBreak)
        att.timeSinceAdBreakBegin = this.timeSinceAdBreakStart.getDeltaTime();

      // Only include timeSinceLastAdError if an ad error has occurred
      if (this.numberOfErrors > 0 && this.timeSinceLastAdError.startTime > 0) {
        att.timeSinceLastAdError = this.timeSinceLastAdError.getDeltaTime();
      }

      att.numberOfAds = this.numberOfAds;
    } else {
      // Content only
      if (this.isRequested) {
        att.timeSinceRequested = this.timeSinceRequested.getDeltaTime();
        att.timeSinceLastHeartbeat = this.timeSinceLastHeartbeat.getDeltaTime();
      }
      if (this.isStarted)
        att.timeSinceStarted = this.timeSinceStarted.getDeltaTime();
      if (this.isPaused)
        att.timeSincePaused = this.timeSincePaused.getDeltaTime();
      if (this.isBuffering)
        att.timeSinceBufferBegin = this.timeSinceBufferBegin.getDeltaTime();
      if (this.isSeeking)
        att.timeSinceSeekBegin = this.timeSinceSeekBegin.getDeltaTime();
      att.timeSinceLastAd = this.timeSinceLastAd.getDeltaTime();

      // Only include timeSinceLastError if a content error has occurred
      if (this.numberOfErrors > 0 && this.timeSinceLastError.startTime > 0) {
        att.timeSinceLastError = this.timeSinceLastError.getDeltaTime();
      }

      att.numberOfVideos = this.numberOfVideos;
    }
    att.numberOfErrors = this.numberOfErrors;

    // Playtime
    if (!this.isAd()) {
      // Content only
      if (this.playtimeSinceLastEvent.startTime > 0) {
        att.playtimeSinceLastEvent = this.playtimeSinceLastEvent.getDeltaTime();
      } else {
        att.playtimeSinceLastEvent = 0;
      }
      if (this.isPlaying) {
        this.playtimeSinceLastEvent.start();
      } else {
        this.playtimeSinceLastEvent.reset();
      }
      this.totalPlaytime += att.playtimeSinceLastEvent;
      att.totalPlaytime = this.totalPlaytime;
    }

    for (const [key, value] of Object.entries(this.customTimeSinceAttributes)) {
      att[key] = value.getDeltaTime();
    }

    return att;
  }

  getQoeAttributes(att) {
      att = att || {};
      const kpi = {};

      try {
          // QoE KPIs - Content only
          if (this.startupTime !== null) {
              kpi["startupTime"] = this.startupTime;
          }
          if (this.peakBitrate > 0) {
              kpi["peakBitrate"] = this.peakBitrate;
          }
          kpi["hadStartupFailure"] = this.hadStartupFailure;
          kpi["hadPlaybackFailure"] = this.hadPlaybackFailure;
          kpi["totalRebufferingTime"] = this.totalRebufferingTime;
          // Calculate rebuffering ratio as percentage (avoid division by zero)
          kpi["rebufferingRatio"] = this.totalPlaytime > 0
              ? (this.totalRebufferingTime / this.totalPlaytime) * 100
              : 0;
          kpi["totalPlaytime"] = this.totalPlaytime;
          kpi["averageBitrate"] = this.weightedBitrate;
      } catch (error) {
          Log.error("Failed to add attributes for QOE KPIs", error.message);
      }

      att.qoe = kpi;
      return att;
  }

  /**
   * Calculate the bufferType attribute.
   *
   * @param {boolean} isInitialBuffering Is initial buffering event.
   */
  calculateBufferType(isInitialBuffering) {
    let bufferType = "";
    if (isInitialBuffering) {
      bufferType = "initial";
    } else if (this.isSeeking) {
      bufferType = "seek";
    } else if (this.isPaused) {
      bufferType = "pause";
    } else {
      // If none of the above is true, it is a connection buffering
      bufferType = "connection";
    }
    Log.debug("Buffer Type = " + bufferType);

    return bufferType;
  }

  /**
   * Augments view count. This will be called with each *_START and *_END.
   */
  goViewCountUp() {
    this._viewCount++;
  }

  /**
   * Checks flags and changes state.
   * @returns {boolean} True if the state changed.
   */
  goPlayerReady() {
    if (!this.isPlayerReady) {
      this.isPlayerReady = true;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goRequest() {
    if (!this.isRequested) {
      this.isRequested = true;

      this.timeSinceLastAd.reset();
      this.timeSinceRequested.start();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goStart() {
    if (this.isRequested && !this.isStarted) {
      if (this.isAd()) {
        this.numberOfAds++;
      } else {
        this.numberOfVideos++;
      }
      this.isStarted = true;
      this.isPlaying = true;
      this.timeSinceStarted.start();
      this.playtimeSinceLastEvent.start();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goEnd() {
    if (this.isRequested) {
      this.numberOfErrors = 0;
      this.resetFlags();
      this.timeSinceRequested.stop();
      this.timeSinceStarted.stop();
      this.playtimeSinceLastEvent.stop();
      this.isPlaying = false;
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goPause() {
    if (this.isStarted && !this.isPaused) {
      this.isPaused = true;
      this.isPlaying = false;
      this.timeSincePaused.start();
      this.playtimeSinceLastEvent.stop();
      this.timeSinceResumed.reset();
      if (this.isBuffering) {
        this._bufferAcc += this.bufferElapsedTime.getDeltaTime();
      }
      this.elapsedTime.start();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goResume() {
    if (this.isStarted && this.isPaused) {
      this.isPaused = false;
      this.isPlaying = true;
      this.timeSincePaused.stop();
      this.timeSinceResumed.start();
      if (this._hb) {
        this._acc = this.elapsedTime.getDeltaTime();
        this._hb = false;
      } else {
        if (this.isBuffering) {
          this.bufferElapsedTime.start();
        }
        this._acc += this.elapsedTime.getDeltaTime();
      }
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goBufferStart() {
    if (this.isRequested && !this.isBuffering) {
      this.isBuffering = true;
      this.isPlaying = false;
      this.timeSinceBufferBegin.start();
      this.bufferElapsedTime.start();

      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goBufferEnd() {
    if (this.isRequested && this.isBuffering) {
      this.isBuffering = false;
      this.isPlaying = true;
      this.timeSinceBufferBegin.stop();
      if (this._hb) {
        this._bufferAcc = this.bufferElapsedTime.getDeltaTime();
        this._hb = false;
      } else {
        this._bufferAcc += this.bufferElapsedTime.getDeltaTime();
      }

      // Accumulate total rebuffering time for content only
      if (!this.isAd() && this.initialBufferingHappened) {
        this.totalRebufferingTime += this.timeSinceBufferBegin.getDeltaTime();
      }

      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goSeekStart() {
    if (this.isStarted && !this.isSeeking) {
      this.isSeeking = true;
      this.isPlaying = false;
      this.timeSinceSeekBegin.start();
      this.timeSinceSeekEnd.reset();

      //new
      // this.seekStartTime = Date.now();

      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goSeekEnd() {
    if (this.isStarted && this.isSeeking) {
      this.isSeeking = false;
      this.isPlaying = true;
      this.timeSinceSeekBegin.stop();
      this.timeSinceSeekEnd.start();

      //new
      // this.seekEndTime = Date.now();
      // this.seekDuration = this.seekEndTime - this.seekStartTime;

      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goAdBreakStart() {
    if (!this.isAdBreak) {
      this.isAdBreak = true;
      this.timeSinceAdBreakStart.start();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goAdBreakEnd() {
    if (this.isAdBreak) {
      this.isRequested = false;
      this.isAdBreak = false;
      this.totalAdPlaytime = this.timeSinceAdBreakStart.getDeltaTime();
      this.timeSinceAdBreakStart.stop();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Restarts download chrono.
   */
  goDownload() {
    this.timeSinceLastDownload.start();
  }

  /**
   * Restarts heartbeat chrono.
   */
  goHeartbeat() {
    this.timeSinceLastHeartbeat.start();
  }

  /**
   * Restarts rendition change chrono.
   */
  goRenditionChange() {
    this.timeSinceLastRenditionChange.start();
  }

  /**
   * Restarts ad quartile chrono.
   */
  goAdQuartile() {
    this.timeSinceLastAdQuartile.start();
  }

  /**
   * Increments error counter and starts appropriate error timer.
   */
  goError() {
    this.isError = true;
    this.numberOfErrors++;

    if (this.isAd()) {
      this.timeSinceLastAdError.start();
    } else {
      this.timeSinceLastError.start();

      // Track failure flags for content errors only
      // Had Startup Failure: error before content started
      if (!this.isStarted) {
        this.hadStartupFailure = true;
      } else {
        // Had Playback Failure: any content error
        this.hadPlaybackFailure = true;
      }
    }
  }

  /**
   * Restarts last ad chrono.
   */
  goLastAd() {
    this.timeSinceLastAd.start();
  }

  /**
   * Updates peak bitrate with current bitrate value (content only).
   * @param {number} bitrate Current content bitrate in bps.
   */
  trackContentBitrateState(bitrate) {
    if (bitrate && typeof bitrate === "number") {
      this.peakBitrate = Math.max(this.peakBitrate, bitrate);

      if(this._lastBitrate === null || this._lastBitrate !== bitrate) {
        const totalPlaytime = this.timeSinceLastRenditionChange.getDeltaTime() || this.totalPlaytime;
        const currentWeightedBitrate = (bitrate * totalPlaytime);
        this.partialAverageBitrate += currentWeightedBitrate;
        this.weightedBitrate = currentWeightedBitrate / totalPlaytime;
        this._lastBitrate = bitrate;
      }
    }
  }

  /**
   * Resets tracked variable for view id change
   * */
  resetViewIdTrackedState() {
    this.peakBitrate = 0;
    this.partialAverageBitrate = 0;
    this.startupTime = null;
    this._lastBitrate = null;
  }

  /** Methods to manage total ads time chrono */
  clearTotalAdsTime() {
    console.log("clear total ads time", this.totalAdTime);
    this._totalAdPlaytime.reset();
  }

  totalAdTime() {
    return this._totalAdPlaytime.getDuration();
  }

  startAdsTime() {
    console.log("startAdsTime");
    return this._totalAdPlaytime.start();
  }

  stopAdsTime() {
    console.log("stopAdsTime");
    return this._totalAdPlaytime.stop();
  }

  setStartupTime(totalAdTime) {
    if (this.startupTime === null) {
      this.startupTime = Math.max(this.timeSinceRequested.getDeltaTime() - totalAdTime, 0)
    }
  }

}

export default VideoTrackerState;
