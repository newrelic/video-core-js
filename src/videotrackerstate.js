import Chrono from './chrono'
import Log from './log'

/**
 * State machine for a VideoTracker and its monitored video.
 */
class VideoTrackerState {
  /** Constructor */
  constructor () {
    this.reset()

    /**
     * Time when the VideoTrackerState was initializated.
     * @private
     */
    this._createdAt = Date.now()
  }

  /** Resets all flags and chronos. */
  reset () {
    /**
     * Unique identifier of the view.
     * @private
     */
    this._viewSession = null

    /**
     * Number of views seen.
     * @private
     */
    this._viewCount = 0

    /**
     * True if it is tracking ads.
     * @private
     */
    this._isAd = false

    /**
     * Number of errors fired. 'End' resets it.
     */
    this.numberOfErrors = 0

    /**
     * Number of ads shown.
     */
    this.numberOfAds = 0

    /**
     * Number of videos played.
     */
    this.numberOfVideos = 0

    /**
     * The amount of ms the user has been watching content (not paused, not buffering, not ads...)
     */
    this.totalPlaytime = 0

    /**
     * The amount of ms the user has been watching ads during an ad break.
     */
     this.totalAdPlaytime = 0

    /** True if you are in the middle of an ad break. */
    this.isAdBreak = false

    /** True if initial buffering event already happened. */
    this.initialBufferingHappened = false

    this.resetFlags()
    this.resetChronos()
  }

  /** Resets flags. */
  resetFlags () {
    /** True once the player has finished loading. */
    this.isPlayerReady = false

    /** True if the video has been user-requested to play. ie: user cicks play. */
    this.isRequested = false

    /** True if the video has starting playing. ie: actual images/audio showing in screen. */
    this.isStarted = false

    /** True if the video is paused. */
    this.isPaused = false

    /** True if the video is performing a seek action. */
    this.isSeeking = false

    /** True if the video is currently buffering. */
    this.isBuffering = false

    /** True if the video is currently playing (not buffering, not paused...) */
    this.isPlaying = false
  }

  /** Resets chronos. */
  resetChronos () {
    /** Chrono that counts time since last requested event. */
    this.timeSinceRequested = new Chrono()

    /** Chrono that counts time since last start event. */
    this.timeSinceStarted = new Chrono()

    /** Chrono that counts time since last pause event. */
    this.timeSincePaused = new Chrono()

    /** Chrono that counts time since last seeking start event. */
    this.timeSinceSeekBegin = new Chrono()

    /** Chrono that counts time since last buffering start event. */
    this.timeSinceBufferBegin = new Chrono()

    /** Chrono that counts time since last ad break start event. */
    this.timeSinceAdBreakStart = new Chrono()

    /** Chrono that counts time since last download event. */
    this.timeSinceLastDownload = new Chrono()

    /** Chrono that counts time since last heartbeat. */
    this.timeSinceLastHeartbeat = new Chrono()

    /** Chrono that counts time since last rendition change. */
    this.timeSinceLastRenditionChange = new Chrono()

    /** Ads only. Chrono that counts time since last ad quartile. */
    this.timeSinceLastAdQuartile = new Chrono()

    /** Content only. Chrono that counts time since last AD_END. */
    this.timeSinceLastAd = new Chrono()

    /** Chrono that counts time since last *_RESUME. Only for buffering events. */
    this.timeSinceResumed = new Chrono()

    /** Chrono that counts time since last *_SEEK_END. Only for buffering events. */
    this.timeSinceSeekEnd = new Chrono()

    /** Chrono that counts the ammount of time the video have been playing since the last event. */
    this.playtimeSinceLastEvent = new Chrono()

    /** A dictionary containing the custom timeSince attributes. */
    this.customTimeSinceAttributes = {}
  }

  /** Returns true if the tracker is currently on ads. */
  isAd () {
    return this._isAd
  }

  /** Sets if the tracker is currenlty tracking ads */
  setIsAd (isAd) {
    this._isAd = isAd
  }

  /**
   * Set the Chrono for the custom attribute
   * 
   * @param {object} name Time since attribute name.
   */
  setTimeSinceAttribute (name) {
    this.customTimeSinceAttributes[name] = new Chrono()
    this.customTimeSinceAttributes[name].start()
  }

  /**
   * Delete a time since attribute
   * 
   * @param {object} name Time since attribute name.
   */
  removeTimeSinceAttribute (name) {
    delete this.customTimeSinceAttributes[name]
  }

  /**
   * Returns a random-generated view Session ID, useful to sort by views.
   */
  getViewSession () {
    if (!this._viewSession) {
      let time = new Date().getTime()
      let random = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)

      this._viewSession = time + '-' + random
    }

    return this._viewSession
  }

  /**
   * Returns a random-generated view Session ID, plus a view count, allowing you to distinguish
   * between two videos played in the same session.
   */
  getViewId () {
    return this.getViewSession() + '-' + this._viewCount
  }

  /**
   * Fills given object with state-based attributes.
   *
   * @param {object} att Collection fo key value attributes
   * @return {object} Filled attributes
   */
  getStateAttributes (att) {
    att = att || {}

    if (this.isAd()) { // Ads only
      if (this.isRequested) {
        att.timeSinceAdRequested = this.timeSinceRequested.getDeltaTime()
        att.timeSinceLastAdHeartbeat = this.timeSinceLastHeartbeat.getDeltaTime()
      }
      if (this.isStarted) att.timeSinceAdStarted = this.timeSinceStarted.getDeltaTime()
      if (this.isPaused) att.timeSinceAdPaused = this.timeSincePaused.getDeltaTime()
      if (this.isBuffering) att.timeSinceAdBufferBegin = this.timeSinceBufferBegin.getDeltaTime()
      if (this.isSeeking) att.timeSinceAdSeekBegin = this.timeSinceSeekBegin.getDeltaTime()
      if (this.isAdBreak) att.timeSinceAdBreakBegin = this.timeSinceAdBreakStart.getDeltaTime()
      att.numberOfAds = this.numberOfAds
    } else { // Content only
      if (this.isRequested) {
        att.timeSinceRequested = this.timeSinceRequested.getDeltaTime()
        att.timeSinceLastHeartbeat = this.timeSinceLastHeartbeat.getDeltaTime()
      }
      if (this.isStarted) att.timeSinceStarted = this.timeSinceStarted.getDeltaTime()
      if (this.isPaused) att.timeSincePaused = this.timeSincePaused.getDeltaTime()
      if (this.isBuffering) att.timeSinceBufferBegin = this.timeSinceBufferBegin.getDeltaTime()
      if (this.isSeeking) att.timeSinceSeekBegin = this.timeSinceSeekBegin.getDeltaTime()
      att.timeSinceLastAd = this.timeSinceLastAd.getDeltaTime()
      att.numberOfVideos = this.numberOfVideos
    }
    att.numberOfErrors = this.numberOfErrors

    // Playtime
    if (!this.isAd()) { // Content only
      if (this.playtimeSinceLastEvent.startTime > 0) {
        att.playtimeSinceLastEvent = this.playtimeSinceLastEvent.getDeltaTime()
      } else {
        att.playtimeSinceLastEvent = 0
      }
      if (this.isPlaying) {
        this.playtimeSinceLastEvent.start()
      } else {
        this.playtimeSinceLastEvent.reset()
      }
      this.totalPlaytime += att.playtimeSinceLastEvent
      att.totalPlaytime = this.totalPlaytime
    }

    for (const [key, value] of Object.entries(this.customTimeSinceAttributes)) {
      att[key] = value.getDeltaTime()
    }

    return att
  }

  /**
   * Calculate the bufferType attribute.
   * 
   * @param {boolean} isInitialBuffering Is initial buffering event.
   */
  calculateBufferType(isInitialBuffering) {
    let bufferType = ''
    if (isInitialBuffering) {
      bufferType = "initial";
    }
    else if (this.isSeeking) {
      bufferType = "seek";
    }
    else if (this.isPaused) {
      bufferType = "pause";
    }
    else {
      // If none of the above is true, it is a connection buffering
      bufferType = "connection";
    }
    Log.debug("Buffer Type = " + bufferType)
    
    return bufferType
  }

  /**
   * Augments view count. This will be called with each *_START and *_END.
   */
  goViewCountUp () {
    this._viewCount++
  }

  /**
   * Checks flags and changes state.
   * @returns {boolean} True if the state changed.
   */
  goPlayerReady () {
    if (!this.isPlayerReady) {
      this.isPlayerReady = true
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goRequest () {
    if (!this.isRequested) {
      this.isRequested = true
      this.timeSinceLastAd.reset()
      this.timeSinceRequested.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goStart () {
    if (this.isRequested && !this.isStarted) {
      if (this.isAd()) {
        this.numberOfAds++
      } else {
        this.numberOfVideos++
      }
      this.isStarted = true
      this.isPlaying = true
      this.timeSinceStarted.start()
      this.playtimeSinceLastEvent.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goEnd () {
    if (this.isRequested) {
      this.numberOfErrors = 0
      this.resetFlags()
      this.timeSinceRequested.stop()
      this.timeSinceStarted.stop()
      this.playtimeSinceLastEvent.stop()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goPause () {
    if (this.isStarted && !this.isPaused) {
      this.isPaused = true
      this.isPlaying = false
      this.timeSincePaused.start()
      this.playtimeSinceLastEvent.stop()
      this.timeSinceResumed.reset()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goResume () {
    if (this.isStarted && this.isPaused) {
      this.isPaused = false
      this.isPlaying = true
      this.timeSincePaused.stop()
      this.timeSinceResumed.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goBufferStart () {
    if (this.isRequested && !this.isBuffering) {
      this.isBuffering = true
      this.isPlaying = false
      this.timeSinceBufferBegin.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goBufferEnd () {
    if (this.isRequested && this.isBuffering) {
      this.isBuffering = false
      this.isPlaying = true
      this.timeSinceBufferBegin.stop()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goSeekStart () {
    if (this.isStarted && !this.isSeeking) {
      this.isSeeking = true
      this.isPlaying = false
      this.timeSinceSeekBegin.start()
      this.timeSinceSeekEnd.reset()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goSeekEnd () {
    if (this.isStarted && this.isSeeking) {
      this.isSeeking = false
      this.isPlaying = true
      this.timeSinceSeekBegin.stop()
      this.timeSinceSeekEnd.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goAdBreakStart () {
    if (!this.isAdBreak) {
      this.isAdBreak = true
      this.timeSinceAdBreakStart.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goAdBreakEnd () {
    if (this.isAdBreak) {
      this.isRequested = false
      this.isAdBreak = false
      this.totalAdPlaytime = this.timeSinceAdBreakStart.getDeltaTime()
      this.timeSinceAdBreakStart.stop()
      return true
    } else {
      return false
    }
  }

  /**
   * Restarts download chrono.
   */
  goDownload () {
    this.timeSinceLastDownload.start()
  }

  /**
   * Restarts heartbeat chrono.
   */
  goHeartbeat () {
    this.timeSinceLastHeartbeat.start()
  }

  /**
   * Restarts rendition change chrono.
   */
  goRenditionChange () {
    this.timeSinceLastRenditionChange.start()
  }

  /**
   * Restarts ad quartile chrono.
   */
  goAdQuartile () {
    this.timeSinceLastAdQuartile.start()
  }

  /**
   * Increments error counter.
   */
  goError () {
    this.numberOfErrors++
  }

  /**
   * Restarts last ad chrono.
   */
  goLastAd () {
    this.timeSinceLastAd.start()
  }
}

export default VideoTrackerState
