import Chrono from '../src/chrono.js'
import chai from 'chai'

const expect = chai.expect

describe('Chrono', () => {
  let chrono

  beforeEach(() => {
    chrono = new Chrono()
  })

  it('should start', () => {
    chrono.start()
    expect(chrono.startTime).to.be.greaterThan(0)
    expect(chrono.stopTime).to.equal(0)
  })

  it('should stop and return time', () => {
    chrono.start()
    expect(chrono.stop()).to.be.greaterThan(-1)
    expect(chrono.getDeltaTime()).to.be.greaterThan(-1)
  })

  it('should not break if stop is called before start', () => {
    expect(chrono.stop()).to.be.null
    expect(chrono.getDeltaTime()).to.be.null
  })

  it('should work', (done) => {
    chrono.start()
    setTimeout(() => {
      expect(chrono.stop()).to.be.closeTo(100, 10)
      expect(chrono.getDeltaTime()).to.be.closeTo(100, 10)
      done()
    }, 100)
  })

  it('should clone propperly', () => {
    chrono.start()
    chrono.stop()
    let chrono2 = chrono.clone()

    expect(chrono.startTime).to.equal(chrono2.startTime)
    expect(chrono.stopTime).to.equal(chrono2.stopTime)
    expect(chrono.offset).to.equal(chrono2.offset)
  })
})
