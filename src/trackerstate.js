import Chrono from './chrono'

/**
 * State machine for a Tracker and its monitored video.
 */
class TrackerState {
  /** Constructor */
  constructor () {
    this.reset()

    /** Chrono that counts time since this class was instantiated. */
    this.timeSinceTrackerReady = new Chrono()
    this.timeSinceTrackerReady.start()
  }

  /** Resets all flags and chronos. */
  reset () {
    /**
     * Unique identifier of the view.
     * @private
     */
    this._viewId = null

    /** Number of views seen. */
    this.viewCount = 0

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

    this.resetFlags()
    this.resetChronos()
  }

  /** Resets flags. */
  resetFlags () {
    /** True whilst the player is redying. ie: from player_init to player_ready. */
    this.isReadyingPlayer = false

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

    /** True if you are in the middle of an ad break. */
    this.isAdBreak = false
  }

  /** Resets chronos. */
  resetChronos () {
    /** Chrono that counts time since player init event. */
    this.timeSincePlayerInit = new Chrono()

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
   * Returns a random-generated view ID, useful to sort by views.
   */
  getViewId () {
    if (!this._viewId) {
      let time = new Date().getTime()
      let random = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2)

      this._viewId = time + '-' + random
    }

    return this._viewId + '-' + this.viewCount
  }

  /**
   * Fills given object with state-based attributes.
   *
   * @param {object} att Collection fo key value attributes
   * @return {object} Filled attributes
   */
  getStateAttributes (att) {
    att = att || {}

    att.timeSinceTrackerReady = this.timeSinceTrackerReady.getDeltaTime()
    if (this.isAd()) {
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
    } else {
      if (this.isRequested) {
        att.timeSinceRequested = this.timeSinceRequested.getDeltaTime()
        att.timeSinceLastHeartbeat = this.timeSinceLastHeartbeat.getDeltaTime()
      }
      if (this.isStarted) att.timeSinceStarted = this.timeSinceStarted.getDeltaTime()
      if (this.isPaused) att.timeSincePaused = this.timeSincePaused.getDeltaTime()
      if (this.isBuffering) att.timeSinceBufferBegin = this.timeSinceBufferBegin.getDeltaTime()
      if (this.isSeeking) att.timeSinceSeekBegin = this.timeSinceSeekBegin.getDeltaTime()
      att.timeSinceLastAd = this.timeSinceLastAd.getDeltaTime()
    }
    att.numberOfErrors = this.numberOfErrors

    return att
  }

  /**
   * Checks flags and changes state
   * @returns {boolean} True if the state changed.
   */
  goPlayerInit () {
    if (!this.isReadyingPlayer) {
      this.isReadyingPlayer = true
      this.timeSincePlayerInit.start()
      return true
    } else {
      return false
    }
  }

  /**
   * Checks flags and changes state. If playerInit was not called, trackerReady will be used
   * as a starting point.
   * @returns {boolean} True if the state changed.
   */
  goPlayerReady () {
    if (this.isReadyingPlayer) {
      this.isReadyingPlayer = false
      this.timeSincePlayerInit.stop()
      return true
    } else if (this.timeSincePlayerInit.startTime === 0) {
      // If player ready is called but the timer has not been initiated, use time since tracker
      // ready instead.
      this.timeSincePlayerInit.startTime = this.timeSinceTrackerReady.startTime
      this.timeSincePlayerInit.stop()
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
      this.viewCount++
      this.isRequested = true
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
      if (this.isAd()) this.numberOfAds++
      this.isStarted = true
      this.timeSinceStarted.start()
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
      this.viewCount++
      this.numberOfErrors = 0
      this.resetFlags()
      this.timeSinceRequested.stop()
      this.timeSinceStarted.stop()
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
      this.timeSincePaused.start()
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
      this.timeSincePaused.stop()
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
    if (this.isStarted && !this.isBuffering) {
      this.isBuffering = true
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
    if (this.isStarted && this.isBuffering) {
      this.isBuffering = false
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
      this.timeSinceSeekBegin.start()
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
      this.timeSinceSeekBegin.stop()
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
      this.isAdBreak = false
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

export default TrackerState
