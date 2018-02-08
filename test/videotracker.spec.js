import VideoTracker from '../src/videotracker'
import Log from '../src/log'
import chai from 'chai'
import sinon from 'sinon'

const expect = chai.expect
const assert = chai.assert

describe('VideoTracker', () => {
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

      global.document = { getElementById: function () { } }
      let spy = sinon.spy(document, 'getElementById')
      tracker.setPlayer('player', 'tag')
      assert(spy.calledTwice)
    })

    it('should send custom data', (done) => {
      tracker = new VideoTracker(null, { customData: { a: 1 } })
      tracker.on(VideoTracker.Events.PLAYER_READY, (e) => {
        expect(e.data.a).to.equal(1)
        done()
      })
      tracker.sendPlayerReady()
    })

    it('should set adsTracker', (done) => {
      tracker = new VideoTracker(null, { adsTracker: new VideoTracker() })
      tracker.adsTracker.on(VideoTracker.Events.AD_END, () => {
        tracker.disposeAdsTracker()
        done()
      })
      tracker.adsTracker.sendRequest()
      tracker.adsTracker.sendEnd()
    })

    it('should calculate webkitbitrate', () => {
      let tag = { webkitVideoDecodedByteCount: 1000 }
      tracker = new VideoTracker(tag)
      expect(tracker.getWebkitBitrate()).to.be.null

      tag.webkitVideoDecodedByteCount += 3000
      expect(tracker.getWebkitBitrate()).to.equal(800)
    })
  })

  function generateTests (ads) {
    let type = ads ? 'for ads' : 'for content'

    describe('EventFiring ' + type, () => {
      beforeEach(() => {
        tracker = new VideoTracker()
        tracker.setIsAd(ads)
      })

      it('should return correct shift', () => {
        tracker = new VideoTracker()
        expect(tracker.getRenditionShift(true)).to.be.null
        tracker.getRenditionBitrate = () => { return 1 }
        expect(tracker.getRenditionShift(true)).to.be.null
        tracker.getRenditionBitrate = () => { return 2 }
        expect(tracker.getRenditionShift()).to.equal('up')
        expect(tracker.getRenditionShift(true)).to.equal('up')
        tracker.getRenditionBitrate = () => { return 1 }
        expect(tracker.getRenditionShift(true)).to.equal('down')
        expect(tracker.getRenditionShift(true)).to.be.null
      })

      it('player ready', (done) => {
        tracker.on(VideoTracker.Events.PLAYER_READY, () => done())
        tracker.sendPlayerReady()
      })

      it('download', (done) => {
        tracker.on(VideoTracker.Events.DOWNLOAD, () => done())
        tracker.sendDownload()
      })

      // Video
      it('request', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'REQUEST', () => done())
        tracker.sendRequest()
      })

      it('start', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'START', () => done())
        tracker.sendRequest()
        tracker.sendStart()
      })

      it('end', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'END', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendEnd()
      })

      it('pause', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'PAUSE', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendPause()
      })

      it('resume', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'RESUME', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendPause()
        tracker.sendResume()
      })

      it('seek start', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'SEEK_START', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendSeekStart()
      })

      it('seek end', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'SEEK_END', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendSeekStart()
        tracker.sendSeekEnd()
      })

      it('buffer start', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'BUFFER_START', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendBufferStart()
      })

      it('buffer end', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'BUFFER_END', () => done())
        tracker.sendRequest()
        tracker.sendStart()
        tracker.sendBufferStart()
        tracker.sendBufferEnd()
      })

      it('heartbeat', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'HEARTBEAT', () => done())
        tracker.sendRequest()
        tracker.sendHeartbeat()
      })

      it('rendition change', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'RENDITION_CHANGE', () => done())
        tracker.sendRenditionChanged()
      })

      it('error', (done) => {
        let prefix = ads ? 'AD_' : 'CONTENT_'
        tracker.on(prefix + 'ERROR', () => done())
        tracker.sendError()
      })

      // Ads only
      if (ads) {
        it('ad break start', (done) => {
          tracker.on(VideoTracker.Events.AD_BREAK_START, () => done())
          tracker.sendAdBreakStart()
        })

        it('ad break end', (done) => {
          tracker.on(VideoTracker.Events.AD_BREAK_END, () => done())
          tracker.sendAdBreakStart()
          tracker.sendAdBreakEnd()
        })

        it('ad quartile', (done) => {
          tracker.on(VideoTracker.Events.AD_QUARTILE, () => done())
          tracker.sendAdQuartile()
        })

        it('ad click', (done) => {
          tracker.on(VideoTracker.Events.AD_CLICK, () => done())
          tracker.sendAdClick()
        })
      }
    })
  }

  generateTests(false)
  generateTests(true)
})
