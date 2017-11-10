import TrackerState from '../src/videotrackerstate.js'
import chai from 'chai'

const expect = chai.expect

describe('VideoTrackerState', () => {
  let state

  beforeEach(() => {
    state = new TrackerState()
  })

  it('should set isAd', () => {
    expect(state.isAd()).to.be.false
    state.setIsAd(true)
    expect(state.isAd()).to.be.true
  })

  it('should getViewId', () => {
    expect(state.getViewId()).to.not.be.undefined
  })

  it('should output attributes', () => {
    state.isStarted = true
    state.isPaused = true
    state.isBuffering = true
    state.isSeeking = true
    state.isAdBreak = true
    expect(typeof state.getStateAttributes()).to.be.equal('object')
    state.setIsAd(true)
    expect(typeof state.getStateAttributes()).to.be.equal('object')
    state.isRequested = true
    expect(typeof state.getStateAttributes()).to.be.equal('object')
    state.setIsAd(false)
    expect(typeof state.getStateAttributes()).to.be.equal('object')
  })

  it('should playerReady', () => {
    expect(state.goPlayerReady()).to.be.true
    expect(state.goPlayerReady()).to.be.false
    expect(state.isPlayerReady).to.be.true
  })

  it('should request, start and end', () => {
    expect(state.isRequested).to.be.false
    expect(state.isStarted).to.be.false

    expect(state.goRequest()).to.be.true
    expect(state.goRequest()).to.be.false
    expect(state.timeSinceRequested.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isRequested).to.be.true

    expect(state.goStart()).to.be.true
    expect(state.goStart()).to.be.false
    expect(state.timeSinceStarted.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isStarted).to.be.true

    expect(state.goEnd()).to.be.true
    expect(state.goEnd()).to.be.false
    expect(state.isStarted).to.be.false
    expect(state.isRequested).to.not.be.true
  })

  it('should increment numberOfAds', () => {
    expect(state.numberOfAds).to.equal(0)
    state.setIsAd(true)
    state.goRequest()
    state.goStart()
    expect(state.numberOfAds).to.equal(1)
  })

  it('should pause and resume', () => {
    state.goRequest()
    state.goStart()

    expect(state.isPaused).to.be.false

    expect(state.goPause()).to.be.true
    expect(state.goPause()).to.be.false
    expect(state.timeSincePaused.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isPaused).to.be.true

    expect(state.goResume()).to.be.true
    expect(state.goResume()).to.be.false
    expect(state.timeSincePaused.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isPaused).to.be.false
  })

  it('should seek', () => {
    state.goRequest()
    state.goStart()

    expect(state.isSeeking).to.be.false

    expect(state.goSeekStart()).to.be.true
    expect(state.goSeekStart()).to.be.false
    expect(state.timeSinceSeekBegin.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isSeeking).to.be.true

    expect(state.goSeekEnd()).to.be.true
    expect(state.goSeekEnd()).to.be.false
    expect(state.timeSinceSeekBegin.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isSeeking).to.be.false
  })

  it('should buffer', () => {
    state.goRequest()
    state.goStart()

    expect(state.isBuffering).to.be.false

    expect(state.goBufferStart()).to.be.true
    expect(state.goBufferStart()).to.be.false
    expect(state.timeSinceBufferBegin.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isBuffering).to.be.true

    expect(state.goBufferEnd()).to.be.true
    expect(state.goBufferEnd()).to.be.false
    expect(state.timeSinceBufferBegin.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isBuffering).to.be.false
  })

  it('should adBreak', () => {
    expect(state.isAdBreak).to.be.false

    expect(state.goAdBreakStart()).to.be.true
    expect(state.goAdBreakStart()).to.be.false
    expect(state.timeSinceAdBreakStart.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isAdBreak).to.be.true

    expect(state.goAdBreakEnd()).to.be.true
    expect(state.goAdBreakEnd()).to.be.false
    expect(state.timeSinceAdBreakStart.getDeltaTime()).to.be.greaterThan(-1)
    expect(state.isAdBreak).to.be.false
  })

  it('should increment numberOfErrors', () => {
    expect(state.numberOfErrors).to.equal(0)
    state.goError()
    expect(state.numberOfErrors).to.equal(1)
  })

  it('should start tineSinceLast timers', () => {
    state.goHeartbeat()
    expect(state.timeSinceLastHeartbeat.getDeltaTime()).to.be.greaterThan(-1)

    state.goLastAd()
    expect(state.timeSinceLastAd.getDeltaTime()).to.be.greaterThan(-1)

    state.goDownload()
    expect(state.timeSinceLastDownload.getDeltaTime()).to.be.greaterThan(-1)

    state.goRenditionChange()
    expect(state.timeSinceLastRenditionChange.getDeltaTime()).to.be.greaterThan(-1)

    state.goAdQuartile()
    expect(state.timeSinceLastAdQuartile.getDeltaTime()).to.be.greaterThan(-1)
  })
})
