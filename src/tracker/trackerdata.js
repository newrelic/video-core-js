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

    /** The CDN serving the video. */
    this.cdn = null

    /** The name of the player. */
    this.playerName = null

    /* The version of the player. */
    this.playerVersion = null

    // Only for ads
    /** 
     * Quartile of the ad. 0 before first, 1 after first quartile, 2 after midpoint, 
     * 3 after third quartile, 4 when completed. */
    this.adQuartile = null

    /** The position of the ad. ie: 'pre', 'mid', 'post', 'companion'. */
    this.adPosition = null

    if (values) Object.assign(this, values)
  }
}
