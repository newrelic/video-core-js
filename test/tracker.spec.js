import Tracker from '../src/tracker'
import Log from '../src/log'
import chai from 'chai'
import sinon from 'sinon'

const expect = chai.expect
const assert = chai.assert

describe('Tracker', () => {
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
      tracker = new Tracker(1, { isAd: true, tag: 2 })
      expect(tracker.isAd()).to.be.true
      expect(tracker.player).to.equal(1)
      expect(tracker.tag).to.equal(2)

      global.document = {getElementById: function () {}}
      let spy = sinon.spy(document, 'getElementById')
      tracker.setPlayer('player', 'tag')
      assert(spy.calledTwice)
    })

    it('should send custom data', (done) => {
      tracker = new Tracker(null, { customData: { a: 1 } })
      tracker.on(Tracker.Events.PLAYER_INIT, (e) => {
        expect(e.data.a).to.equal(1)
        done()
      })
      tracker.sendPlayerInit()
    })

    it('should set adsTracker', (done) => {
      tracker = new Tracker(null, { adsTracker: new Tracker() })
      tracker.adsTracker.on('AD_' + Tracker.Events.REQUEST, () => {
        tracker.disposeAdsTracker()
        done()
      })
      tracker.adsTracker.sendRequest()
    })

    it('should calculate webkitbitrate', () => {
      let tag = { webkitVideoDecodedByteCount: 1000 }
      tracker = new Tracker(tag)
      expect(tracker.getWebkitBitrate()).to.be.null

      tag.webkitVideoDecodedByteCount += 3000
      expect(tracker.getWebkitBitrate()).to.equal(800)
    })
  })

  describe('EventFiring', () => {
    beforeEach(() => {
      tracker = new Tracker()
    })

    it('player init', (done) => {
      tracker.on(Tracker.Events.PLAYER_INIT, () => done())
      tracker.sendPlayerInit()
    })

    it('player ready', (done) => {
      tracker.on(Tracker.Events.PLAYER_READY, () => done())
      tracker.sendPlayerInit()
      tracker.sendPlayerReady()
    })

    it('download', (done) => {
      tracker.on(Tracker.Events.DOWNLOAD, () => done())
      tracker.sendDownload()
    })

    // Video
    it('request', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.REQUEST, () => done())
      tracker.sendRequest()
    })

    it('start', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
    })

    it('end', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendEnd()
    })

    it('pause', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.PAUSE, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendPause()
    })

    it('resume', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.RESUME, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendPause()
      tracker.sendResume()
    })

    it('seek start', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.SEEK_START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendSeekStart()
    })

    it('seek end', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.SEEK_END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendSeekStart()
      tracker.sendSeekEnd()
    })

    it('buffer start', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.BUFFER_START, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendBufferStart()
    })

    it('buffer end', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.BUFFER_END, () => done())
      tracker.sendRequest()
      tracker.sendStart()
      tracker.sendBufferStart()
      tracker.sendBufferEnd()
    })

    it('heartbeat', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.HEARTBEAT, () => done())
      tracker.sendRequest()
      tracker.sendHeartbeat()
    })

    it('rendition change', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.RENDITION_CHANGE, () => done())
      tracker.sendRenditionChanged()
    })

    it('error', (done) => {
      tracker.on('CONTENT_' + Tracker.Events.ERROR, () => done())
      tracker.sendError()
    })

    // Ads only
    it('ad break start', (done) => {
      tracker.setIsAd(true)
      tracker.on(Tracker.Events.AD_BREAK_START, () => done())
      tracker.sendAdBreakStart()
    })

    it('ad break end', (done) => {
      tracker.setIsAd(true)
      tracker.on(Tracker.Events.AD_BREAK_END, () => done())
      tracker.sendAdBreakStart()
      tracker.sendAdBreakEnd()
    })

    it('ad quartile', (done) => {
      tracker.setIsAd(true)
      tracker.on(Tracker.Events.AD_QUARTILE, () => done())
      tracker.sendAdQuartile()
    })

    it('ad click', (done) => {
      tracker.setIsAd(true)
      tracker.on(Tracker.Events.AD_CLICK, () => done())
      tracker.sendAdClick()
    })
  })
})
