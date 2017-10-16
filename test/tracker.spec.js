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

  describe('setting', () => {
    it('should unregister listeners when disposing', () => {
      tracker = new Tracker()
      let spy = sinon.spy(tracker, 'unregisterListeners')
      tracker.dispose()

      assert(spy.called, 'unregisterListeners not called')
      spy.restore()
    })

    it('should set options', () => {
      // construct
      tracker = new Tracker({ customData: { key: 'value' } })
      expect(tracker.customData.key).to.equal('value')

      // no change
      tracker.setOptions()
      expect(tracker.customData.key).to.equal('value')

      // change
      tracker.setOptions({ customData: { key: 'value2' } })
      expect(tracker.customData.key).to.equal('value2')
    })

    it('should send custom data', (done) => {
      tracker = new Tracker({ customData: { a: 1 } })
      tracker.on('EVENT', (e) => {
        expect(e.data.a).to.equal(1)
        done()
      })
      tracker.send('EVENT')
    })

    it('should return attributes', () => {
      tracker = new Tracker()
      let att = tracker.getAttributes()
      expect(att.trackerName).to.not.be.undefined
      expect(att.trackerVersion).to.not.be.undefined
      expect(att.coreVersion).to.not.be.undefined
      expect(att.timeSinceTrackerReady).to.not.be.undefined
    })
  })

  describe('heartbeating', () => {
    it('should return heartbeat', () => {
      tracker = new Tracker()
      expect(tracker.getHeartbeat()).to.equal(30000)

      tracker.setOptions({ parentTracker: new Tracker({ heartbeat: 20000 }) })
      expect(tracker.getHeartbeat()).to.equal(20000)

      tracker.setOptions({ heartbeat: 10000 })
      expect(tracker.getHeartbeat()).to.equal(10000)
    })

    it('should send heartbeat', (done) => {
      tracker.on(Tracker.Events.HEARTBEAT, () => done())
      tracker.sendHeartbeat()
    })

    it('should start and stop heartbeats', (done) => {
      tracker = new Tracker({ heartbeat: 500 })
      tracker.on(Tracker.Events.HEARTBEAT, () => done.fail())
      setInterval(() => done(), 750)
      tracker.startHeartbeat()
      tracker.stopHeartbeat()
    })
  })
})
