import VideoTracker from '../src/videotracker'
import Log from '../src/log'
import chai from 'chai'
import sinon from 'sinon'

const expect = chai.expect
const assert = chai.assert

describe('VideoVideoTracker', () => {
  let tracker

  // Mute console
  before(() => {
    Log.level = Log.Levels.SILENT
  })

  after(() => {
    Log.level = Log.Levels.ERROR
  })

  describe('settings', () => {
    it('should set options', () => {
      tracker = new VideoTracker(1, { isAd: true, tag: 2 })
      expect(tracker.isAd()).to.be.true
      expect(tracker.player).to.equal(1)
      expect(tracker.tag).to.equal(2)

      global.document = {getElementById: function () {}}
      let spy = sinon.spy(document, 'getElementById')
      tracker.setPlayer('player', 'tag')
      assert(spy.calledTwice)
    })

    it('should send custom data', (done) => {
      tracker = new VideoTracker(null, { customData: { a: 1 } })
      tracker.on(VideoTracker.Events.PLAYER_INIT, (e) => {
        expect(e.data.a).to.equal(1)
        done()
      })
      tracker.sendPlayerInit()
    })

    it('should set adsTracker', (done) => {
      tracker = new VideoTracker(null, { adsTracker: new VideoTracker() })
      tracker.adsTracker.on('AD_' + VideoTracker.Events.REQUEST, () => {
        tracker.disposeAdsTracker()
        done()
      })
      tracker.adsTracker.sendRequest()
    })

    it('should calculate webkitbitrate', () => {
      let tag = { webkitVideoDecodedByteCount: 1000 }
      tracker = new VideoTracker(tag)
      expect(tracker.getWebkitBitrate()).to.be.null

      tag.webkitVideoDecodedByteCount += 3000
      expect(tracker.getWebkitBitrate()).to.equal(800)
    })
  })

  describe('EventFiring', () => {
    beforeEach(() => {
      tracker = new VideoTracker()
    })

    it('player init', (done) => {
      tracker.on(VideoTracker.Events.PLAYER_INIT, () => done())
      tracker.sendPlayerInit()
    })

    it('player ready', (done) => {
      tracker.on(VideoTracker.Events.PLAYER_READY, () => done())
      tracker.sendPlayerInit()
      tracker.sendPlayerReady()
    })

    it('download', (done) => {
      tracker.on(VideoTracker.Events.DOWNLOAD, () => done())
      tracker.sendDownload()
    })

    // Video
    it('request', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.REQUEST, () => done())
      tracker.sendRequest()
    })

    it('start', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
    })

    it('end', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendEnd()
    })

    it('pause', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.PAUSE, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendPause()
    })

    it('resume', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.RESUME, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendPause()
      tracker.sendResume()
    })

    it('seek start', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.SEEK_START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendSeekStart()
    })

    it('seek end', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.SEEK_END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendSeekStart()
      tracker.sendSeekEnd()
    })

    it('buffer start', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.BUFFER_START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendBufferStart()
    })

    it('buffer end', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.BUFFER_END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendBufferStart()
      tracker.sendBufferEnd()
    })

    it('heartbeat', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.HEARTBEAT, () => done())
      tracker.sendRequest()
      tracker.sendHeartbeat()
    })

    it('rendition change', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.RENDITION_CHANGE, () => done())
      tracker.sendRenditionChanged()
    })

    it('error', (done) => {
      tracker.on('CONTENT_' + VideoTracker.Events.ERROR, () => done())
      tracker.sendError()
    })

    // Ads only
    it('ad break start', (done) => {
      tracker.setIsAd(true)
      tracker.on(VideoTracker.Events.AD_BREAK_START, () => done())
      tracker.sendAdBreakStart()
    })

    it('ad break end', (done) => {
      tracker.setIsAd(true)
      tracker.on(VideoTracker.Events.AD_BREAK_END, () => done())
      tracker.sendAdBreakStart()
      tracker.sendAdBreakEnd()
    })

    it('ad quartile', (done) => {
      tracker.setIsAd(true)
      tracker.on(VideoTracker.Events.AD_QUARTILE, () => done())
      tracker.sendAdQuartile()
    })

    it('ad click', (done) => {
      tracker.setIsAd(true)
      tracker.on(VideoTracker.Events.AD_CLICK, () => done())
      tracker.sendAdClick()
    })
  })
})
