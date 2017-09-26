import Log from './log'
import Tracker from './tracker'
import TrackerState from './videotrackerstate'
import * as pkg from '../package.json'

/**
 * Base video tracker class provides extensible tracking over video elements. See {@link Tracker}.
 * Extend this class to create your own video tracker class. Override getter methods and
 * registerListeners/unregisterListeners to provide full integration with your video experience.
 *
 * @example
 * Tracker instances should be added to Core library to start sending data:
 * nrvideo.Core.addTracker(new Tracker())
 *
 * @extends Tracker
 */
class VideoTracker extends Tracker {
  /**
   * Constructor, receives player and options.
   * Lifecycle: constructor > {@link setOptions} > {@link setPlayer} > {@link registerListeners}.
   *
   * @param {Object} [player] Player to track. See {@link setPlayer}.
   * @param {Object} [options] Options for the tracker. See {@link setOptions}.
   */
  constructor (player, options) {
    super()

    /**
     * TrackerState instance. Stores the state of the view. Tracker will automatically update the
     * state of its instance, so there's no need to modify/interact with it manually.
     * @type TrackerState
     */
    this.state = new TrackerState()

    /**
     * If you add something to this custom dictionary it will be added to every report. If you set
     * any value, it will always override the values returned by the getters.
     *
     * @example
     * If you define tracker.customData.contentTitle = 'a' and tracker.getTitle() returns 'b'.
     * 'a' will prevail.
     */
    this.customData = {}

    /**
     * Another Tracker instance. Useful to relate ad Trackers to their parent content Trackers.
     * @type Tracker
     */
    this.parentTracker = null

    /**
     * Another Tracker instance to track ads.
     * @type Tracker
     */
    this.adsTracker = null

    /**
     * Set time between hearbeats, in ms.
     */
    this.heartbeat = null

    options = options || {}
    this.setOptions(options)
    if (player) this.setPlayer(player, options.tag)

    Log.notice('Tracker ' + this.getTrackerName() + ' v' + this.getTrackerVersion() + ' is ready.')
  }

  /**
   * Set options for the Tracker.
   *
   * @param {Object} [options] Options for the tracker.
   * @param {Boolean} [options.isAd] True if the tracker is tracking ads. See {@link setIsAd}.
   * @param {Object} [options.customData] Set custom data. See {@link customData}.
   * @param {Tracker} [options.parentTracker] Set parent tracker. See {@link parentTracker}.
   * @param {Tracker} [options.adsTracker] Set ads tracker. See {@link adsTracker}.
   * @param {number} [options.heartbeat] Set time between heartbeats. See {@link heartbeat}.
   * @param {Object} [options.tag] DOM element to track. See {@link setPlayer}.
   */
  setOptions (options) {
    if (options) {
      if (options.customData) this.customData = options.customData
      if (options.parentTracker) this.parentTracker = options.parentTracker
      if (options.adsTracker) this.setAdsTracker(options.adsTracker)
      if (options.heartbeat) this.heartbeat = options.heartbeat
      if (typeof options.isAd === 'boolean') this.setIsAd(options.isAd)
    }
  }

  /**
   * Set a player and/or a tag. If there was one already defined, it will call dispose() first.
   * Will call this.registerListeners() afterwards.
   *
   * @param {Object|string} player New player to save as this.player. If a string is passed,
   * document.getElementById will be called.
   * @param {DOMObject|string} [tag] Optional DOMElement to save as this.tag. If a string is passed,
   * document.getElementById will be called.
   */
  setPlayer (player, tag) {
    if (this.player || this.tag) this.dispose()

    if (typeof document !== 'undefined' && document.getElementById) {
      if (typeof player === 'string') player = document.getElementById(player)
      if (typeof tag === 'string') tag = document.getElementById(tag)
    }

    tag = tag || player // if no tag is passed, use player as both.

    this.player = player
    this.tag = tag
    this.registerListeners()
  }

  /** Returns true if the tracker is currently on ads. */
  isAd () {
    return this.state.isAd()
  }

  /** Sets if the tracker is currenlty tracking ads */
  setIsAd (isAd) {
    this.state.setIsAd(isAd)
  }

  /**
   * Use this function to set up a child ad tracker. You will be able to access it using
   * this.adsTracker.
   *
   * @param {Tracker} tracker Ad tracker to add
   */
  setAdsTracker (tracker) {
    this.disposeAdsTracker() // dispose current one
    if (tracker) {
      this.adsTracker = tracker
      this.adsTracker.setIsAd(true)
      this.adsTracker.parentTracker = this
      this.adsTracker.on('*', funnelAdEvents.bind(this))
    }
  }

  /**
   * Dispose current adsTracker.
   */
  disposeAdsTracker () {
    if (this.adsTracker) {
      this.adsTracker.off('*', funnelAdEvents)
      this.adsTracker.dispose()
    }
  }

  /**
   * Prepares tracker to dispose. Calls unregisterListener and drops references to player and tag.
   */
  dispose () {
    this.stopHeartbeat()
    this.disposeAdsTracker()
    this.unregisterListeners()
    this.player = null
    this.tag = null
  }

  /**
   * Do not override.
   * Returns heartbeat time interval. 30.000 if not set. See {@link setOptions}.
   * @return {number} Heartbeat interval in ms.
   * @final
   */
  getHeartbeat () {
    if (this.heartbeat) {
      return this.heartbeat
    } else if (this.parentTracker && this.parentTracker.heartbeat) {
      return this.parentTracker.heartbeat
    } else {
      return 30000
    }
  }

  /**
   * Override this method to register listeners to player/tag.
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  registerListeners () {}

  /**
   * Override this method to unregister listeners to player/tag created in registerListeners
   * @example
   * class SpecificTracker extends Tracker {
   *  registerListeners() {
   *    this.player.on('play', () => this.playHandler)
   *  }
   *
   *  unregisterListeners() {
   *    this.player.off('play', () => this.playHandler)
   *  }
   *
   *  playHandler() {
   *    this.emit(Tracker.Events.REQUESTED)
   *  }
   * }
   */
  unregisterListeners () {}

  /** Override to change of the Version of tracker. ie: '1.0.1' */
  getTrackerVersion () {
    return pkg.version
  }

  /** Override to change of the Name of the tracker. ie: 'custom-html5' */
  getTrackerName () {
    return 'base-tracker'
  }

  /**
   * Trackers will generate unique id's for every new video iteration. If you have your own unique
   * view value, you can override this method to return it.
   * If the tracker has a parentTracker defined, parent viewId will be used.
   */
  getViewId () {
    if (this.parentTracker) {
      return this.parentTracker.getViewId()
    } else {
      return this.state.getViewId()
    }
  }

  /** Override to return Title of the video. */
  getTitle () {
    return null
  }

  /** Override to return True if the video is live. */
  isLive () {
    return null
  }

  /** Override to return Bitrate (in bits) of the video. */
  getBitrate () {
    return null
  }

  /** Calculates consumed bitrate using webkitVideoDecodedByteCount. */
  getWebkitBitrate () {
    if (this.tag && this.tag.webkitVideoDecodedByteCount) {
      let bitrate
      if (this._lastWebkitBitrate) {
        bitrate = this.tag.webkitVideoDecodedByteCount
        let delta = bitrate - this._lastWebkitBitrate
        let seconds = this.getHeartbeat() / 1000
        bitrate = Math.round((delta / seconds) * 8)
      }
      this._lastWebkitBitrate = this.tag.webkitVideoDecodedByteCount
      return bitrate || null
    }
  }

  /** Override to return Name of the rendition (ie: 1080p). */
  getRenditionName () {
    return null
  }

  /** Override to return Target Bitrate of the rendition. */
  getRenditionBitrate () {
    return null
  }

  /** Override to return renidtion actual Height (before re-scaling). */
  getRenditionHeight () {
    return this.tag ? this.tag.videoHeight : null
  }

  /** Override to return rendition actual Width (before re-scaling). */
  getRenditionWidth () {
    return this.tag ? this.tag.videoWidth : null
  }

  /** Override to return Duration of the video, in ms. */
  getDuration () {
    return this.tag ? this.tag.duration : null
  }

  /** Override to return Playhead (currentTime) of the video, in ms. */
  getPlayhead () {
    return this.tag ? this.tag.currentTime : null
  }

  /**
   * Override to return Language of the video. We recommend using locale notation, ie: en_US.
   * {@see https://gist.github.com/jacobbubu/1836273}
   */
  getLanguage () {
    return null
  }

  /** Override to return URL of the resource being played. */
  getSrc () {
    return this.tag ? this.tag.currentSrc : null
  }

  /** Override to return Playrate (speed) of the video. ie: 1.0, 0.5, 1.25... */
  getPlayrate () {
    return this.tag ? this.tag.playbackRate : null
  }

  /** Override to return True if the video is currently muted. */
  isMuted () {
    return this.tag ? this.tag.muted : null
  }

  /** Override to return True if the video is currently fullscreen. */
  isFullscreen () {
    return null
  }

  /** Override to return the CDN serving the content. */
  getCdn () {
    return null
  }

  /** Override to return the Name of the player. */
  getPlayerName () {
    return this.getTrackerName()
  }

  /** Override to return the Version of the player. */
  getPlayerVersion () {
    return null
  }

  /** Override to return current FPS (Frames per second). */
  getFps () {
    return null
  }

  // Only for ads
  /**
   * Override to return Quartile of the ad. 0 before first, 1 after first quartile, 2 after
   * midpoint, 3 after third quartile, 4 when completed.
   */
  getAdQuartile () {
    return null
  }

  /**
   * Override to return the position of the ad. Use {@link Constants.AdPositions} enum
   * to fill this data.
   */
  getAdPosition () {
    return this.state.isStarted ? 'pre' : 'mid'
  }

  /**
   * Override to return if the player was autoplayed. By default: this.tag.autoplay
   */
  isAutoplayed () {
    return this.tag ? this.tag.autoplay : null
  }

  /**
   * Override to return the player preload attribute. By default: this.tag.preload
   */
  getPreload () {
    return this.tag ? this.tag.preload : null
  }

  /**
   * Do NOT override. This method fills all the appropiate attributes for tracked video.
   *
   * @param {object} [att] Collection of key value attributes
   * @return {object} Filled attributes
   * @final
   */
  getAttributes (att) {
    att = att || {}

    att.viewId = this.getViewId()
    att.trackerName = this.getTrackerName()
    att.trackerVersion = this.getTrackerVersion()
    att.coreVersion = pkg.version
    att.playerName = this.getPlayerName()
    att.playerVersion = this.getPlayerVersion()
    try {
      att.pageUrl = window.location.href
    } catch (err) { /* skip */ }

    if (this.isAd()) { // Ads
      att.adTitle = this.getTitle()
      att.adBitrate = this.getBitrate() || this.getWebkitBitrate()
      att.adRenditionName = this.getRenditionName()
      att.adRenditionBitrate = this.getRenditionBitrate()
      att.adRenditionHeight = this.getRenditionHeight()
      att.adRenditionWidth = this.getRenditionWidth()
      att.adDuration = this.getDuration()
      att.adPlayhead = this.getPlayhead()
      att.adLanguage = this.getLanguage()
      att.adSrc = this.getSrc()
      att.adCdn = this.getCdn()
      att.adIsMuted = this.isMuted()
      att.adFps = this.getFps()
      // ad exclusives
      att.adQuartile = this.getAdQuartile()
      att.adPosition = this.getAdPosition()
    } else { // no ads
      att.contentTitle = this.getTitle()
      att.contentIsLive = this.isLive()
      att.contentBitrate = this.getBitrate() || this.getWebkitBitrate()
      att.contentRenditionName = this.getRenditionName()
      att.contentRenditionBitrate = this.getRenditionBitrate()
      att.contentRenditionHeight = this.getRenditionHeight()
      att.contentRenditionWidth = this.getRenditionWidth()
      att.contentDuration = this.getDuration()
      att.contentPlayhead = this.getPlayhead()
      att.contentLanguage = this.getLanguage()
      att.contentSrc = this.getSrc()
      att.contentPlayrate = this.getPlayrate()
      att.contentIsFullscreen = this.isFullscreen()
      att.contentIsMuted = this.isMuted()
      att.contentCdn = this.getCdn()
      att.contentIsAutoplayed = this.isAutoplayed()
      att.contentPreload = this.getPreload()
      att.contentFps = this.getFps()
    }

    this.state.getStateAttributes(att)

    for (let key in this.customData) {
      att[key] = this.customData[key]
    }

    return att
  }

  /**
   * Sends that the player starts loading.
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendPlayerInit (att) {
    if (this.state.goPlayerInit()) {
      this.emit(Tracker.Events.PLAYER_INIT, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendPlayerReady (att) {
    if (this.state.goPlayerReady()) {
      att = att || {}
      att.timeSincePlayerInit = this.state.timeSincePlayerInit.getDeltaTime()
      this.emit(Tracker.Events.PLAYER_READY, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners. Calls
   * {@link startHeartbeat}.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendRequest (att) {
    if (this.state.goRequest()) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.REQUEST, this.getAttributes(att))
      this.startHeartbeat()
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendStart (att) {
    if (this.state.goStart()) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners. Calls
   * {@link stopHeartbeat}.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendEnd (att) {
    if (this.state.goEnd()) {
      att = att || {}
      let prefix
      if (this.isAd()) {
        prefix = 'AD_'
        att.timeSinceAdRequested = this.state.timeSinceRequested.getDeltaTime()
        att.timeSinceAdStarted = this.state.timeSinceStarted.getDeltaTime()
      } else {
        prefix = 'CONTENT_'
        att.timeSinceRequested = this.state.timeSinceRequested.getDeltaTime()
        att.timeSinceStarted = this.state.timeSinceStarted.getDeltaTime()
      }
      this.stopHeartbeat()
      this.emit(prefix + Tracker.Events.END, this.getAttributes(att))
      if (this.parentTracker && this.isAd()) this.parentTracker.state.goLastAd()
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendPause (att) {
    if (this.state.goPause()) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.PAUSE, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendResume (att) {
    if (this.state.goResume()) {
      att = att || {}
      let prefix
      if (this.isAd()) {
        prefix = 'AD_'
        att.timeSinceAdPaused = this.state.timeSincePaused.getDeltaTime()
      } else {
        prefix = 'CONTENT_'
        att.timeSincePaused = this.state.timeSincePaused.getDeltaTime()
      }
      this.emit(prefix + Tracker.Events.RESUME, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendBufferStart (att) {
    if (this.state.goBufferStart()) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.BUFFER_START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendBufferEnd (att) {
    if (this.state.goBufferEnd()) {
      att = att || {}
      let prefix
      if (this.isAd()) {
        prefix = 'AD_'
        att.timeSinceAdBufferBegin = this.state.timeSinceBufferBegin.getDeltaTime()
      } else {
        prefix = 'CONTENT_'
        att.timeSinceBufferBegin = this.state.timeSinceBufferBegin.getDeltaTime()
      }
      this.emit(prefix + Tracker.Events.BUFFER_END, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendSeekStart (att) {
    if (this.state.goSeekStart()) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.SEEK_START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendSeekEnd (att) {
    if (this.state.goSeekEnd()) {
      att = att || {}
      let prefix
      if (this.isAd()) {
        prefix = 'AD_'
        att.timeSinceAdSeekBegin = this.state.timeSinceSeekBegin.getDeltaTime()
      } else {
        prefix = 'CONTENT_'
        att.timeSinceSeekBegin = this.state.timeSinceSeekBegin.getDeltaTime()
      }
      this.emit(prefix + Tracker.Events.SEEK_END, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   * @param {String} att.state Download requires a string to distinguish different states.
   */
  sendDownload (att) {
    att = att || {}
    if (!att.state) Log.warn('Called sendDownload without { state: xxxxx }.')
    this.emit(Tracker.Events.DOWNLOAD, this.getAttributes(att))
    this.state.goDownload()
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendError (att) {
    this.state.goError()
    let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
    this.emit(prefix + Tracker.Events.ERROR, this.getAttributes(att))
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendRenditionChanged (att) {
    att = att || {}
    att.timeSinceLastRenditionChange = this.state.timeSinceLastRenditionChange.getDeltaTime()
    let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
    this.emit(prefix + Tracker.Events.RENDITION_CHANGE, this.getAttributes(att))
    this.state.goRenditionChange()
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendAdBreakStart (att) {
    if (this.isAd() && this.state.goAdBreakStart()) {
      this.emit(Tracker.Events.AD_BREAK_START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   */
  sendAdBreakEnd (att) {
    if (this.isAd() && this.state.goAdBreakEnd()) {
      att = att || {}
      att.timeSinceAdBreakBegin = this.state.timeSinceAdBreakStart.getDeltaTime()
      this.emit(Tracker.Events.AD_BREAK_END, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   * @param {number} att.quartile Number of the quartile.
   */
  sendAdQuartile (att) {
    if (this.isAd()) {
      att = att || {}
      if (!att.quartile) Log.warn('Called sendAdQuartile without { quartile: xxxxx }.')
      att.timeSinceLastAdQuartile = this.state.timeSinceLastAdQuartile.getDeltaTime()
      this.emit(Tracker.Events.AD_QUARTILE, this.getAttributes(att))
      this.state.goAdQuartile()
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Should be associated to an event using registerListeners.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   * @param {number} att.url Url of the clicked ad.
   */
  sendAdClick (att) {
    if (this.isAd()) {
      att = att || {}
      if (!att.url) Log.warn('Called sendAdClick without { url: xxxxx }.')
      this.emit(Tracker.Events.AD_CLICK, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. Heartbeat will automatically be sent every
   * 10 seconds. There's no need to call this manually.
   * @param {Object} [att] Collection of key:value attributes to send with the request.
   * @param {number} att.url Url of the clicked ad.
   *
   */
  sendHeartbeat (att) {
    if (this.state.isRequested) {
      let prefix = this.isAd() ? 'AD_' : 'CONTENT_'
      this.emit(prefix + Tracker.Events.HEARTBEAT, this.getAttributes(att))
      this.state.goHeartbeat()
    }
  }

  /**
   * Starts heartbeating. Interval period set by options.heartbeat. Min 5000 ms.
   * This method is automaticaly called by the tracker once sendRequest is called.
   */
  startHeartbeat () {
    this._heartbeatInterval = setInterval(
      this.sendHeartbeat.bind(this),
      Math.max(this.getHeartbeat(), 5000)
    )
  }

  /**
   * Stops heartbeating. This method is automaticaly called by the tracker.
   */
  stopHeartbeat () {
    if (this._heartbeatInterval) {
      clearInterval(this._heartbeatInterval)
    }
  }
}

/**
 * Enumeration of events fired by this class.
 *
 * @static
 * @memberof Tracker
 * @enum
 */
Tracker.Events = {
  // Player
  PLAYER_INIT: 'PLAYER_INIT',
  PLAYER_READY: 'PLAYER_READY',
  DOWNLOAD: 'DOWNLOAD',

  // Video
  REQUEST: 'REQUEST',
  START: 'START',
  END: 'END',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SEEK_START: 'SEEK_START',
  SEEK_END: 'SEEK_END',
  BUFFER_START: 'BUFFER_START',
  BUFFER_END: 'BUFFER_END',
  HEARTBEAT: 'HEARTBEAT',
  RENDITION_CHANGE: 'RENDITION_CHANGE',
  ERROR: 'ERROR',

  // Ads only
  AD_BREAK_START: 'AD_BREAK_START',
  AD_BREAK_END: 'AD_BREAK_END',
  AD_QUARTILE: 'AD_QUARTILE',
  AD_CLICK: 'AD_CLICK'
}

// Private members
function funnelAdEvents (e) {
  this.emit(e.type, e.data)
}

export default VideoTracker
