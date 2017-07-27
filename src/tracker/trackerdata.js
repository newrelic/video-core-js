/**
 * Any data defined here will override any info gotten from {@link nrvideo.Tracker} getters.
 */
export class TrackerData {
  /**
   * Constructor.
   * 
   * @param {object} [values] You can set default TrackerData values with this object.
   */
  constructor (values) {
    /** Title of the video. */
    this.title = null

    /** True if the video is live. */
    this.isLive = null

    /** Bitrate (in bits) of the video. */
    this.bitrate = null

    /** Name of the rendition (ie: 1080p). */
    this.renditionName = null

    /** Target bitrate of the rendition. */
    this.renditionBitrate = null

    /** Rendition height (before re-scaling). */
    this.renditionHeight = null

    /** Rendition width (before re-scaling). */
    this.renditionWidth = null

    /** Duration of the video, in ms. */
    this.duration = null

    /** Playhead (currentTime) of the video, in ms. */
    this.playhead = null

    /** 
     * Language of the video. We recommend using locale notation, ie: en_US.
     * {@see https://gist.github.com/jacobbubu/1836273}
     */
    this.language = null

    /** URL of the resource being played. */
    this.src = null

    /** Playrate (speed) of the video. ie: 1.0, 0.5, 1.25... */
    this.playrate = null

    /** True if the video is currently muted. */
    this.isMuted = null

    /** True if the video is currently fullscreen. */
    this.isFullscreen = null

    /** Player DOM element width in pixels. */
    this.width = null

    /** Player DOM element height in pixels. */
    this.height = null

    // Only for ads
    /** True if the ad has passed first quartile (included). */
    this.isFirstQuartile = null

    /** True if the ad has passed midpoint (included). */
    this.isMidpoint = null

    /** True if the ad has passed third quartile (included). */
    this.isThirdQuartile = null

    /** True if the ad is a pre-roll */
    this.isPreRoll = null

    /** True if the ad is a mid-roll */
    this.isMidRoll = null

    /** True if the ad is a post-roll */
    this.isPostRoll = null

    if (values) Object.assign(this, values)
  }
}
