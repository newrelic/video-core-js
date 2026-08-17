import Chrono from "./chrono";
import Log from "./log";

/**
 * State machine for a VideoTracker and its monitored video.
 */
class VideoTrackerState {
  _viewSession: string | null = null;
  _viewCount: number = 0;
  _isAd: boolean = false;
  numberOfErrors: number = 0;
  numberOfAds: number = 0;
  numberOfVideos: number = 0;
  totalPlaytime: number = 0;
  weightedAverageBitrate: number = 0;
  totalAdPlaytime: number = 0;
  isAdBreak: boolean = false;
  initialBufferingHappened: boolean = false;
  startupTime: number | null = null;
  peakBitrate: number = 0;
  partialAverageBitrate: number = 0;
  _totalBitrateDuration: number = 0;
  weightedBitrate: number = 0;
  _lastBitrate: number | null = null;
  _lastBitrateChangeTimestamp: number | null = null;
  _downloadBitrates: number[] = [];
  _lastDownloadBitrate: number | null = null;
  totalSwitchUps: number = 0;
  totalSwitchDowns: number = 0;
  totalPauseTime: number = 0;
  _playedRenditions: Set<string> = new Set();
  hadStartupError: boolean = false;
  hadPlaybackError: boolean = false;
  totalRebufferingTime: number = 0;

  isPlayerReady: boolean = false;
  isRequested: boolean = false;
  isStarted: boolean = false;
  isPaused: boolean = false;
  isSeeking: boolean = false;
  isBuffering: boolean = false;
  isPlaying: boolean = false;

  timeSinceRequested!: Chrono;
  timeSinceStarted!: Chrono;
  timeSincePaused!: Chrono;
  timeSinceSeekBegin!: Chrono;
  timeSinceBufferBegin!: Chrono;
  timeSinceAdBreakStart!: Chrono;
  timeSinceLastDownload!: Chrono;
  timeSinceLastHeartbeat!: Chrono;
  timeSinceLastRenditionChange!: Chrono;
  timeSinceLastAdQuartile!: Chrono;
  timeSinceLastAd!: Chrono;
  timeSinceLastError!: Chrono;
  timeSinceLastAdError!: Chrono;
  timeSinceResumed!: Chrono;
  timeSinceSeekEnd!: Chrono;
  playtimeSinceLastEvent!: Chrono;
  customTimeSinceAttributes: Record<string, Chrono> = {};
  elapsedTime!: Chrono;
  bufferElapsedTime!: Chrono;
  _totalAdPlaytime!: Chrono;

  /** @private */
  _createdAt: number;
  _hb: boolean;
  _acc: number;
  _bufferAcc: number;
  isError?: boolean;

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
  reset(): void {
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
     * Time-weighted bitrate calculation accumulators
     */
    this.partialAverageBitrate = 0;
    this._totalBitrateDuration = 0;
    this.weightedBitrate = 0;
    this._lastBitrate = null;
    this._lastBitrateChangeTimestamp = null;

    /**
     * Array of changed network download bitrate values (only values that differ from previous).
     * Used for calculating simple mean, min, max (not time-weighted).
     */
    this._downloadBitrates = [];

    /**
     * Previous download bitrate value to detect changes.
     */
    this._lastDownloadBitrate = null;

    /**
     * QOE v1.1: Total number of rendition/quality switches where bitrate increased.
     */
    this.totalSwitchUps = 0;

    /**
     * QOE v1.1: Total number of rendition/quality switches where bitrate decreased.
     */
    this.totalSwitchDowns = 0;

    /**
     * QOE v1.1: Total time in milliseconds spent in paused state (intentional pauses only).
     * Calculated from timeSincePaused chrono accumulation.
     */
    this.totalPauseTime = 0;

    /**
     * QOE v1.1: Set of distinct renditions played, keyed by "heightxwidth" (e.g., "1080x1920").
     */
    this._playedRenditions = new Set();

    /**
     * Had Startup Error: TRUE if CONTENT_ERROR occurs before CONTENT_START.
     */
    this.hadStartupError = false;

    /**
     * Had Playback Error: TRUE if CONTENT_ERROR occurs during content playback.
     */
    this.hadPlaybackError = false;

    /**
     * The amount of ms the user has been rebuffering during content playback.
     */
    this.totalRebufferingTime = 0;

    this.resetFlags();
    this.resetChronos();
  }

  /** Resets flags. */
  resetFlags(): void {
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
  resetChronos(): void {
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
  isAd(): boolean {
    return this._isAd;
  }

  /** Sets if the tracker is currenlty tracking ads */
  setIsAd(isAd: boolean): void {
    this._isAd = isAd;
  }

  /**
   * Set the Chrono for the custom attribute
   *
   * @param {object} name Time since attribute name.
   */
  setTimeSinceAttribute(name: string): void {
    this.customTimeSinceAttributes[name] = new Chrono();
    this.customTimeSinceAttributes[name].start();
  }

  /**
   * Delete a time since attribute
   *
   * @param {object} name Time since attribute name.
   */
  removeTimeSinceAttribute(name: string): void {
    delete this.customTimeSinceAttributes[name];
  }

  /**
   * Returns a random-generated view Session ID, useful to sort by views.
   */
  getViewSession(): string {
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
  getViewId(): string {
    return this.getViewSession() + "-" + this._viewCount;
  }

  /**
   * Fills given object with state-based attributes.
   *
   * @param {object} att Collection fo key value attributes
   * @return {object} Filled attributes
   */
  getStateAttributes(att?: Record<string, any>): Record<string, any> {
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

  getQoeAttributes(att?: Record<string, any>): Record<string, any> {
      att = att || {};
      const kpi: Record<string, any> = {};

      try {
          // QoE v1 KPIs
          if (this.startupTime !== null) {
              kpi["startupTime"] = this.startupTime;
          }
          if (this.peakBitrate > 0) {
              kpi["peakBitrate"] = this.peakBitrate;
          }
          kpi["hadStartupError"] = this.hadStartupError;
          kpi["hadPlaybackError"] = this.hadPlaybackError;
          kpi["totalRebufferingTime"] = this.totalRebufferingTime;
          kpi["rebufferingRatio"] = this.totalPlaytime > 0
              ? (this.totalRebufferingTime / this.totalPlaytime) * 100
              : 0;
          kpi["totalPlaytime"] = this.totalPlaytime;
          kpi["averageBitrate"] = this.weightedBitrate;
          kpi["numberOfErrors"] = this.numberOfErrors;

          // QoE v1.1 KPIs - Download rate (simple mean of changed values)
          if (this._downloadBitrates.length > 0) {
              const sum = this._downloadBitrates.reduce((a, b) => a + b, 0);
              kpi["avgDownloadRate"] = Math.round(sum / this._downloadBitrates.length);
              kpi["minDownloadRate"] = Math.min(...this._downloadBitrates);
              kpi["maxDownloadRate"] = Math.max(...this._downloadBitrates);
          }

          // QoE v1.1 KPIs - Rendition switching
          kpi["totalSwitchUps"] = this.totalSwitchUps;
          kpi["totalSwitchDowns"] = this.totalSwitchDowns;

          // QoE v1.1 KPIs - Pause and session timing
          kpi["totalPauseTime"] = this.timeSincePaused.getDuration();
          kpi["totalViewSessionTime"] = this.totalPlaytime;

          // QoE v1.1 KPIs - Renditions
          kpi["totalRenditions"] = this._playedRenditions.size;

          // Version tag
          kpi["qoeAggregateVersion"] = "1.1.0";

      } catch (error: any) {
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
  calculateBufferType(isInitialBuffering: boolean): string {
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
  goViewCountUp(): void {
    this._viewCount++;
  }

  /**
   * Checks flags and changes state.
   * @returns {boolean} True if the state changed.
   */
  goPlayerReady(): boolean {
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
  goRequest(): boolean {
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
  goStart(): boolean {
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
  goEnd(): boolean {
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
  goPause(): boolean {
    if (this.isStarted && !this.isPaused) {
      this.isPaused = true;
      this.isPlaying = false;
      this.timeSincePaused.start();
      this.playtimeSinceLastEvent.stop();
      this.timeSinceResumed.reset();
      if (this.isBuffering) {
        this._bufferAcc += this.bufferElapsedTime.getDeltaTime() as number;
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
  goResume(): boolean {
    if (this.isStarted && this.isPaused) {
      this.isPaused = false;
      this.isPlaying = true;
      this.timeSincePaused.stop();
      this.timeSinceResumed.start();
      if (this._hb) {
        this._acc = this.elapsedTime.getDeltaTime() as number;
        this._hb = false;
      } else {
        if (this.isBuffering) {
          this.bufferElapsedTime.start();
        }
        this._acc += this.elapsedTime.getDeltaTime() as number;
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
  goBufferStart(): boolean {
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
  goBufferEnd(): boolean {
    if (this.isRequested && this.isBuffering) {
      this.isBuffering = false;
      this.isPlaying = true;
      this.timeSinceBufferBegin.stop();
      if (this._hb) {
        this._bufferAcc = this.bufferElapsedTime.getDeltaTime() as number;
        this._hb = false;
      } else {
        this._bufferAcc += this.bufferElapsedTime.getDeltaTime() as number;
      }

      // Accumulate total rebuffering time for content only
      // Use exact stopped duration (stopTime - startTime) instead of live getDeltaTime()
      if (!this.isAd() && this.initialBufferingHappened) {
        this.totalRebufferingTime +=
            (this.timeSinceBufferBegin.stopTime - this.timeSinceBufferBegin.startTime);
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
  goSeekStart(): boolean {
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
  goSeekEnd(): boolean {
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
  goAdBreakStart(): boolean {
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
  goAdBreakEnd(): boolean {
    if (this.isAdBreak) {
      this.isRequested = false;
      this.isAdBreak = false;
      this.totalAdPlaytime = this.timeSinceAdBreakStart.getDeltaTime() as number;
      this.timeSinceAdBreakStart.stop();
      return true;
    } else {
      return false;
    }
  }

  /**
   * Restarts download chrono.
   */
  goDownload(): void {
    this.timeSinceLastDownload.start();
  }

  /**
   * Restarts heartbeat chrono.
   */
  goHeartbeat(): void {
    this.timeSinceLastHeartbeat.start();
  }

  /**
   * Restarts rendition change chrono.
   */
  goRenditionChange(): void {
    this.timeSinceLastRenditionChange.start();
  }

  /**
   * Restarts ad quartile chrono.
   */
  goAdQuartile(): void {
    this.timeSinceLastAdQuartile.start();
  }

  /**
   * Increments error counter and starts appropriate error timer.
   */
  goError(): void {
    this.isError = true;
    this.numberOfErrors++;

    if (this.isAd()) {
      this.timeSinceLastAdError.start();
    } else {
      this.timeSinceLastError.start();

      // Track error flags for content errors only
      // Had Startup Error: error before content started
      if (!this.isStarted) {
        this.hadStartupError = true;
      } else {
        // Had Playback Error: any content error during playback
        this.hadPlaybackError = true;
      }
    }
  }

  /**
   * Restarts last ad chrono.
   */
  goLastAd(): void {
    this.timeSinceLastAd.start();
  }

  /**
   * Updates peak bitrate and time-weighted average bitrate (content only).
   * @param {number} bitrate Current content bitrate in bps.
   */
  trackContentBitrateState(bitrate: number): void {
    if (bitrate && typeof bitrate === "number") {
      this.peakBitrate = Math.max(this.peakBitrate, bitrate);

      const now = Date.now();

      // If not playing (buffering, paused, etc.), close the current segment
      // so non-play time is excluded from the weighted average
      if (!this.isPlaying) {
        if (this._lastBitrate !== null && this._lastBitrateChangeTimestamp !== null) {
          const segmentDuration = now - this._lastBitrateChangeTimestamp;
          if (segmentDuration > 0) {
            this.partialAverageBitrate += this._lastBitrate * segmentDuration;
            this._totalBitrateDuration += segmentDuration;
          }
          this._lastBitrateChangeTimestamp = null; // Mark as paused
        }
        this._lastBitrate = bitrate;
        return;
      }

      // Playing: restart timestamp if returning from non-play state
      if (this._lastBitrateChangeTimestamp === null && this._lastBitrate !== null) {
        this._lastBitrateChangeTimestamp = now;
      }

      // Close the PREVIOUS segment when bitrate changes
      if (this._lastBitrate !== null && this._lastBitrate !== bitrate
          && this._lastBitrateChangeTimestamp !== null) {
        const segmentDuration = now - this._lastBitrateChangeTimestamp;
        if (segmentDuration > 0) {
          this.partialAverageBitrate += this._lastBitrate * segmentDuration;
          this._totalBitrateDuration += segmentDuration;
        }
        this._lastBitrateChangeTimestamp = now;
      }

      // Initialize timestamp on first observation
      if (this._lastBitrateChangeTimestamp === null) {
        this._lastBitrateChangeTimestamp = now;
      }

      this._lastBitrate = bitrate;

      // Compute weighted average including current in-progress segment
      let totalWeighted = this.partialAverageBitrate;
      let totalDuration = this._totalBitrateDuration;
      const currentSegment = now - this._lastBitrateChangeTimestamp;
      if (currentSegment > 0) {
        totalWeighted += bitrate * currentSegment;
        totalDuration += currentSegment;
      }
      this.weightedBitrate = totalDuration > 0
          ? Math.round(totalWeighted / totalDuration)
          : bitrate;
    }
  }

  /**
   * Records network download bitrate observation. Only tracks values that differ from previous.
   * @param {number} bps Network throughput in bits per second.
   */
  trackDownloadRate(bps: number): void {
    if (!bps || typeof bps !== "number" || bps <= 0) return;
    if (bps !== this._lastDownloadBitrate) {
      this._downloadBitrates.push(bps);
      this._lastDownloadBitrate = bps;
    }
  }

  /**
   * Records a rendition play event (height x width combination).
   * @param {number} height Rendition height in pixels.
   * @param {number} width Rendition width in pixels.
   */
  addPlayedRendition(height: number, width: number): void {
    if (height && width) {
      this._playedRenditions.add(`${height}x${width}`);
    }
  }


  /**
   * Resets tracked variable for view id change
   * */
  resetViewIdTrackedState(): void {
    this.peakBitrate = 0;
    this.startupTime = null;
    this.partialAverageBitrate = 0;
    this._totalBitrateDuration = 0;
    this.weightedBitrate = 0;
    this._lastBitrate = null;
    this._lastBitrateChangeTimestamp = null;
    this._downloadBitrates = [];
    this._lastDownloadBitrate = null;
    this.totalSwitchUps = 0;
    this.totalSwitchDowns = 0;
    this.timeSincePaused.reset();
    this._playedRenditions = new Set();
  }

  /** Methods to manage total ads time chrono */
  clearTotalAdsTime(): void {
    Log.debug("clear total ads time", this.totalAdTime);
    this._totalAdPlaytime.reset();
  }

  totalAdTime(): number {
    return this._totalAdPlaytime.getDuration();
  }

  startAdsTime(): void {
    Log.debug("startAdsTime");
    return this._totalAdPlaytime.start();
  }

  stopAdsTime(): number | null {
    Log.debug("stopAdsTime");
    return this._totalAdPlaytime.stop();
  }

  setStartupTime(totalAdTime: number): void {
    if (this.startupTime === null) {
      this.startupTime = Math.max((this.timeSinceRequested.getDeltaTime() as number) - totalAdTime, 0)
    }
  }

}

export default VideoTrackerState;
