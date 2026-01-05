import VideoTracker from '../src/videotracker'

describe('VideoTracker Playtime', () => {
  let tracker, adTracker
  
  it('playtime calc should be right', (done) => {
    tracker = new VideoTracker(1)
    adTracker = new VideoTracker(1)
    tracker.setAdsTracker(adTracker)

    tracker.sendRequest()
    tracker.sendStart()

    // Initial playtime should be close to 0
    const initialPlaytime = tracker.getAttributes().totalPlaytime
    expect(initialPlaytime).toBeLessThan(10)

    setTimeout(() => {
      tracker.sendPause()
      const playtime1 = tracker.getAttributes().totalPlaytime
      expect(playtime1).toBeGreaterThanOrEqual(90)
      expect(playtime1).toBeLessThanOrEqual(150)

      setTimeout(() => {
        tracker.sendResume()
        const playtime2 = tracker.getAttributes().totalPlaytime
        expect(playtime2).toBeGreaterThanOrEqual(90)
        expect(playtime2).toBeLessThanOrEqual(150)

        setTimeout(() => {
          adTracker.sendRequest()
          adTracker.sendStart()
          const playtime3 = tracker.getAttributes().totalPlaytime
          expect(playtime3).toBeGreaterThanOrEqual(190)
          expect(playtime3).toBeLessThanOrEqual(250)

          setTimeout(() => {
            adTracker.sendEnd()
            const playtime4 = tracker.getAttributes().totalPlaytime
            expect(playtime4).toBeGreaterThanOrEqual(190)
            expect(playtime4).toBeLessThanOrEqual(250)

            done()
          }, 100)
        }, 100)
      }, 100)
    }, 100)
  })
})