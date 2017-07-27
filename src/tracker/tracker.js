import { Emitter } from '../emitter'
import { TrackerData } from './trackerdata'
import { version } from '../../package.json'

export class Tracker extends Emitter {
  constructor (player, tag, options) {
    super()

    options = options || {}
    this._viewId = null
    this._viewCount = 1

    /**
     * Store options from the constructor.
     * @private
     */
    this._options = options

    if (player) this.setPlayer(player, tag)

    /**
     * TrackerData instance, if you define a variable there, it will override the value gotten
     * from a getter. 
     * 
     * @example If you define tracker.data.title = 'a' and tracker.getTitle() returns 'b'. 'a' will 
     * prevail.
     * @type nrvideo.TrackerData
     */
    this.data = new TrackerData(options.data)
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
    return version
  }

  /** Override this to change of the name of the tracker. ie: 'custom-html5' */
  getTrackerName () {
    return 'base-tracker'
  }

  /**
   * Trackers will generate unique id's for every new video iteration. If you have your own unique
   * view value, you can override this method to return it.
   */
  getViewId () {
    if (!this._viewId) {
      let time = new Date().getTime()
      let random = Math.random().toString(36).substring(12)

      this._viewId = time + '-' + random
      this._viewCount++
    }

    return this._viewId + '-' + this._viewCount
  }

  /**
   * Force viewId to increment when a new view starts.
   */
  nextView () {
    this._viewId = null
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
    return null
  }

  /** Override to return Rendition width (before re-scaling). */
  getRenditionWidth () {
    return null
  }

  /** Override to return Duration of the video, in ms. */
  getDuration () {
    return null
  }

  /** Override to return Playhead (currentTime) of the video, in ms. */
  getPlayhead () {
    return null
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
    return null
  }

  /** Override to return Playrate (speed) of the video. ie: 1.0, 0.5, 1.25... */
  getPlayrate () {
    return null
  }

  /** Override to return True if the video is currently muted. */
  isMuted () {
    return null
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
  playerName () {
    return null
  }

  /* Override to return the version of the player. */
  playerVersion () {
    return null
  }

  // Only for ads
  /** 
   * Override to return Quartile of the ad. 0 before first, 1 after first quartile, 2 after 
   * midpoint, 3 after third quartile, 4 when completed. 
   */
  getQuartile () {
    return null
  }

  /** Override to return The position of the ad. ie: 'pre', 'mid', 'post', 'companion'. */
  getPosition () {
    return null
  }
}

Tracker.Events = {
  REQUESTED: 'REQUESTED',
  START: 'START',
  END: 'END',
  PAUSE: 'PAUSE',
  RESUME: 'RESUME',
  SEEK_START: 'SEEK_START',
  SEEK_END: 'SEEK_END',
  BUFFER_START: 'BUFFER_START',
  BUFFER_END: 'BUFFER_END',
  INPROGRESS: 'INPROGRESS',
  RENDITION_CHANGE: 'RENDITION_CHANGE',
  ERROR: 'ERROR',

  // Ads only
  BREAK_START: 'BREAK_START',
  BREAK_END: 'BREAK_END',
  QUARTILE: 'QUARTILE',
  CLICK: 'CLICK'
}
