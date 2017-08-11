import Log from './log'
import Emitter from './emitter'
import TrackerState from './trackerstate'
import * as pkg from '../package.json'

/**
 * Base Tracker class provides extensible tracking over video elements. Extend this class to create
 * you own tracker, override getter classes and register/unregister listeners for full coverage!
 * 
 * @memberof nrvideo
 */
export default class Tracker extends Emitter {
  /**
   * Constructor, receives options.
   * @param {Object} [player] Player to track. {@link setPlayer}
   * @param {Object} [options]
   * @param {Boolean} [options.isAd] True if the tracker is tracking ads. See {@link setIsAd}.
   * @param {Object} [options.customData] Set custom data. See {@link customData}.
   * @param {Tracker} [options.parentTracker] Set parent tracker. See {@link parentTracker}.
   * @param {Tracker} [options.adsTracker] Set ads tracker. See {@link adsTracker}.
   * @param {number} [options.heartbeat] Set time between heartbeats. See {@link heartbeat}.
   * @param {Object} [options.tag] DOM element to track. See {@link setPlayer}.
   */
  constructor (player, options) {
    super()
    options = options || {}

    /**
     * TrackerState instance. Stores the state of the view. Tracker will automatically update the
     * state of its instance, so there's no need to tamper with it manually.
     * @type nrvideo.TrackerState
     */
    this.state = new TrackerState()

    /**
     * If you add something to this custom dictionary it will be added to every report. If you set
     * any value, it will always override the values gotten from the getters.
     * 
     * @example 
     * If you define tracker.customData.contentTitle = 'a' and tracker.getTitle() returns 'b'. 
     * 'a' will prevail.
     */
    this.customData = options.customData || {}

    /**
     * Another Tracker instance. Useful to relate ad Trackers to their parent content Trackers.
     * @type nrvideo.Tracker
     */
    this.parentTracker = options.parentTracker || null

    /**
     * Another Tracker instance. Useful to relate ad Trackers to their parent content Trackers.
     * @type nrvideo.Tracker
     */
    this.adsTracker = options.adsTracker || null

    /**
     * Time between hearbeats, in ms.
     */
    this.heartbeat = options.heartbeat || 10000

    if (typeof options.isAd === 'boolean') this.setIsAd(options.isAd)
    if (player) this.setPlayer(player, options.tag)

    Log.notice('Tracker ' + this.getTrackerName() + ' v' + this.getTrackerVersion() + ' is ready.')
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

    if (document && document.getElementById) {
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
   * Prepares tracker to dispose. Calls unregisterListener and drops references to player and tag.
   */
  dispose () {
    this.unregisterListeners()
    this.player = null
    this.tag = null
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

  /** Override this to change of the version of tracker. ie: '1.0.1' */
  getTrackerVersion () {
    return pkg.version
  }

  /** Override this to change of the name of the tracker. ie: 'custom-html5' */
  getTrackerName () {
    return 'base-tracker'
  }

  /**
   * Trackers will generate unique id's for every new video iteration. If you have your own unique
   * view value, you can override this method to return it.
   * If the trackes has a parentTracker defined, parent viewId will be used.
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
      let bitrate = this.tag.webkitVideoDecodedByteCount
      if (this._lastWebkitBitrate) {
        let delta = bitrate - this._lastWebkitBitrate
        bitrate = Math.round((delta / (this.heartbeat / 1000)) * 8)
      }
      this._lastWebkitBitrate = this.tag.webkitVideoDecodedByteCount
      return bitrate || null
    }
  }

  /** Override to return Name of the rendition (ie: 1080p). */
  getRenditionName () {
    return null
  }

  /** Override to return Target bitrate of the rendition. */
  getRenditionBitrate () {
    return null
  }

  /** Override to return Rendition height (before re-scaling). */
  getRenditionHeight () {
    return this.tag ? this.tag.videoHeight : null
  }

  /** Override to return Rendition width (before re-scaling). */
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

  /** Override to return Player DOM element width in pixels. */
  getWidth () {
    return this.tag ? this.tag.width : null
  }

  /** Override to return Player DOM element height in pixels. */
  getHeight () {
    return this.tag ? this.tag.height : null
  }

  /** Override to return the CDN serving the content */
  getCdn () {
    return null
  }

  /** Override to return the name of the player. */
  getPlayerName () {
    return this.getTrackerName()
  }

  /** Override to return the version of the player. */
  getPlayerVersion () {
    return null
  }

  /** Override this to return current fps. */
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
   * Override to return The position of the ad. Use {@link nrvideo.Constants.AdPositions} enum 
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
   * Do NOT override. This function fill all the appropiate attributes for tracked video.
   * 
   * @param {object} [att] Collection fo key value attributes
   * @return {object} Filled attributes
   * @final
   */
  getAttributes (att) {
    att = att || {}

    att.viewId = this.getViewId()
    att.trackerVersion = this.getTrackerVersion()
    att.trackerName = this.getTrackerName()
    att.playerVersion = this.getPlayerVersion()
    att.playerName = this.getPlayerName()
    try {
      att.pageUrl = window.location.href
    } catch (err) { /* skip */ }

    att.isAd = this.isAd()

    if (this.isAd()) { // Ads only
      att.adTitle = this.getTitle()
      att.adIsLive = this.isLive()
      att.adBitrate = this.getBitrate() || this.getWebkitBitrate()
      att.adRenditionName = this.getRenditionName()
      att.adRenditionBitrate = this.getRenditionBitrate()
      att.adRenditionHeight = this.getRenditionHeight()
      att.adRenditionWidth = this.getRenditionWidth()
      att.adDuration = this.getDuration()
      att.adPlayhead = this.getPlayhead()
      att.adLanguage = this.getLanguage()
      att.adSrc = this.getSrc()
      att.adPlayrate = this.getPlayrate()
      att.adHeight = this.getHeight()
      att.adWidth = this.getWidth()
      att.adIsFullscreen = this.isFullscreen()
      att.adIsMuted = this.isMuted()
      att.adCdn = this.getCdn()
      att.adIsAutoplayed = this.isAutoplayed()
      att.adPreload = this.getPreload()
      att.adFps = this.getFps()
      // ad exclusives
      att.adQuartile = this.getAdQuartile()
      att.adPosition = this.getAdPosition()
    } else { // not ads
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
      att.contentHeight = this.getHeight()
      att.contentWidth = this.getWidth()
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
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendPlayerInit (att) {
    if (this.state.goPlayerInit()) {
      this.emit(Tracker.Events.PLAYER_INIT, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
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
   * duplicated events. Calls {@link startHeartbeat}.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendRequest (att) {
    if (this.state.goRequest()) {
      this.emit(
        this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.REQUEST,
        this.getAttributes(att)
      )
      this.startHeartbeat()
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendStart (att) {
    if (this.state.goStart()) {
      this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events. Calls {@link stopHeartbeat}.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendEnd (att) {
    if (this.state.goEnd()) {
      att = att || {}
      att.timeSinceRequested = this.state.timeSinceRequested.getDeltaTime()
      att.timeSinceStarted = this.state.timeSinceStarted.getDeltaTime()
      this.stopHeartbeat()
      this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.END, this.getAttributes(att))
      if (this.parentTracker && this.isAd()) this.parentTracker.state.goLastAd()
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendPause (att) {
    if (this.state.goPause()) {
      this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.PAUSE, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendResume (att) {
    if (this.state.goResume()) {
      att = att || {}
      att.timeSincePaused = this.state.timeSincePaused.getDeltaTime()
      this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.RESUME, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendBuffeStart (att) {
    if (this.state.goBufferStart()) {
      this.emit(
        this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.BUFFER_START,
        this.getAttributes(att)
      )
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendBufferEnd (att) {
    if (this.state.goBufferEnd()) {
      att = att || {}
      att.timeSinceBufferBegin = this.state.timeSinceBufferBegin.getDeltaTime()
      this.emit(
        this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.BUFFER_END,
        this.getAttributes(att)
      )
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendSeekStart (att) {
    if (this.state.goSeekStart()) {
      this.emit(
        this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.SEEK_START,
        this.getAttributes(att)
      )
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendSeekEnd (att) {
    if (this.state.goSeekEnd()) {
      att = att || {}
      att.timeSinceSeekBegin = this.state.timeSinceSeekBegin.getDeltaTime()
      this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.SEEK_END, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   * @param {String} att.state Download requires a string to distinguish different states.
   */
  sendDownload (att) {
    if (!att.state) Log.warn('Called sendDownload without { state: xxxxx }.')
    this.emit(Tracker.Events.DOWNLOAD, this.getAttributes(att))
    this.state.goDownload()
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendError (att) {
    this.state.goError()
    this.emit(this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.ERROR, this.getAttributes(att))
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendRenditionChanged (att) {
    att = att || {}
    att.timeSinceLastRenditionChange = this.state.timeSinceLastRenditionChange.getDeltaTime()
    this.emit(
      this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.RENDITION_CHANGE,
      this.getAttributes(att)
    )
    this.state.goRenditionChange()
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendAdBreakStart (att) {
    if (this.isAd() && this.state.goAdBreakStart()) {
      this.emit(Tracker.Events.AD_BREAK_START, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   */
  sendAdBreakEnd (att) {
    if (this.isAd() && this.state.goSeekEnd()) {
      att = att || {}
      att.timeSinceAdBreakBegin = this.state.timeSinceAdBreakBegin.getDeltaTime()
      this.emit(Tracker.Events.AD_BREAK_END, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   * @param {number} att.quartile Number of the quartile.
   */
  sendAdQuartile (att) {
    if (this.isAd()) {
      if (!att.quartile) Log.warn('Called sendAdQuartile without { quartile: xxxxx }.')
      att = att || {}
      att.timeSinceLastAdQuartile = this.state.timeSinceLastAdQuartile.getDeltaTime()
      this.emit(Tracker.Events.AD_QUARTILE, this.getAttributes(att))
    }
  }

  /**
   * Sends associated event and changes view state. An internal state machine will prevent
   * duplicated events.
   * @param {Object} [att] Collection fo key:value attributes to send with the request.
   * @param {number} att.url Url of the clicked ad.
   * 
   */
  sendAdClick (att) {
    if (this.isAd()) {
      if (!att.url) Log.warn('Called sendAdClick without { url: xxxxx }.')
      this.emit(Tracker.Events.AD_CLICK, this.getAttributes(att))
    }
  }

  sendHeartbeat (att) {
    if (this.state.isRequested) {
      this.emit(
        this.isAd() ? 'AD_' : 'CONTENT_' + Tracker.Events.HEARTBEAT,
        this.getAttributes(att)
      )
      this.state.goHeartbeat()
    }
  }

  /**
   * Starts heartbeating. Interval period set by options.heartbeat. Min 5000 ms.
   * This method is automaticaly called by the tracker.
   */
  startHeartbeat () {
    this._heartbeatInterval = setInterval(
      this.sendHeartbeat.bind(this),
      Math.max(this.heartbeat, 5000)
    )
  }

  /**
   * Stops heartbeating. This method is automaticaly called by the tracker.
   */
  stopHeartbeat () {
    clearInterval(this._heartbeatInterval)
  }
}

/**
 * Enumeration of events fired by this class.
 * 
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
