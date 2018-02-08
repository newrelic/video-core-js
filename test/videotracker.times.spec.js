import VideoTracker from '../src/videotracker'
import chai from 'chai'

const expect = chai.expect

describe('VideoTracker Playtime', () => {
  let tracker, adTracker

  it('playtime calc should be right', (done) => {
    tracker = new VideoTracker(1)
    adTracker = new VideoTracker(1)
    tracker.setAdsTracker(adTracker)

    tracker.sendRequest()
    tracker.sendStart()
    expect(tracker.getAttributes().totalPlaytime).to.be.closeTo(0, 10)

    setTimeout(() => {
      tracker.sendPause()
      expect(tracker.getAttributes().totalPlaytime).to.be.closeTo(100, 10)

      setTimeout(() => {
        tracker.sendResume()
        expect(tracker.getAttributes().totalPlaytime).to.be.closeTo(100, 10)

        setTimeout(() => {
          adTracker.sendRequest()
          adTracker.sendStart()
          expect(tracker.getAttributes().totalPlaytime).to.be.closeTo(200, 10)

          setTimeout(() => {
            adTracker.sendEnd()
            expect(tracker.getAttributes().totalPlaytime).to.be.closeTo(200, 10)

            done()
          }, 100)
        }, 100)
      }, 100)
    }, 100)
  })
})
