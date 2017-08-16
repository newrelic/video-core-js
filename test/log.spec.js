import Log from '../src/log.js'
import chai from 'chai'
import sinon from 'sinon'

const assert = chai.assert

// check loadFromUrl to not throw
global.window = { location: { search: '?nrvideo-debug=0&nrvideo-colors=false' } }

describe('Log', () => {
  let cwarn = console.warn
  let clog = console.log
  let cdebug = console.debug
  let cerror = console.error

  before(() => {
    Log.level = Log.Levels.ALL
    Log.colorful = true
    console.warn = function () {}
    console.log = function () {}
    console.debug = function () {}
    console.error = function () {}
  })

  after(() => {
    console.warn = cwarn
    console.log = clog
    console.debug = cdebug
    console.error = cerror
  })

  it('should print error', () => {
    let spy = sinon.spy(console, 'error')
    Log.error('msg')
    assert(spy.called)
    spy.restore()
  })

  it('should print warning', () => {
    let spy = sinon.spy(console, 'warn')
    Log.warn('msg')
    assert(spy.called)
    spy.restore()
  })

  it('should print notice', () => {
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    assert(spy.called)
    spy.restore()
  })

  it('should print debug', () => {
    let spy = sinon.spy(console, 'debug')
    Log.debug('msg')
    assert(spy.called)
    spy.restore()
  })

  it('should exclude times', () => {
    Log.includeTime = false
    let spy = sinon.spy(console, 'debug')
    Log.debug('msg')
    assert(spy.called)
    spy.restore()
    Log.includeTime = true
  })

  it('should not print higher level logs', () => {
    Log.level = Log.Levels.SILENT
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    assert(spy.notCalled)
    spy.restore()
    Log.level = Log.Levels.ALL
  })

  it('should colorless report', () => {
    Log.colorful = false
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    assert(spy.called)
    spy.restore()
  })

  it('should colorless report objects', () => {
    Log.colorful = false
    let spy = sinon.spy(console, 'log')
    Log.notice({})
    assert(spy.calledTwice)
    spy.restore()
  })

  describe('debugCommonVideoEvents', () => {
    it('with on', () => {
      let o = { on: sinon.spy() }
      Log.debugCommonVideoEvents(o)
      assert(o.on.called)
    })

    it('with addEventListener and custom event', () => {
      let o = { addEventListener: sinon.spy() }
      Log.debugCommonVideoEvents(o, ['custom'])
      assert(o.addEventListener.called)
    })

    it('with function and all custom events', () => {
      let o = sinon.spy()
      Log.debugCommonVideoEvents(o, [null, 'custom'])
      assert(o.called)
    })

    it('should not throw', () => {
      let spy = sinon.spy(console, 'warn')
      Log.colorful = true
      Log.debugCommonVideoEvents({on: () => { throw new Error('error') }})
      assert(spy.called)
      spy.restore()
    })
  })
})
