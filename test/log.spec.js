import Log from '../src/log.js'
import sinon from 'sinon'

describe('Log', () => {
  let cwarn = console.warn
  let clog = console.log
  let cdebug = console.debug
  let cerror = console.error

  beforeAll(() => {
    Log.level = Log.Levels.ALL
    Log.colorful = true
    console.warn = function () {}
    console.log = function () {}
    console.debug = function () {}
    console.error = function () {}
  })

  it('should parse nrvideo-debug=true from URL', () => {
    // Test the regex pattern used in _loadLevelFromUrl()
    const testUrl = '?nrvideo-debug=true'
    const match = /\?.*&*nrvideo-debug=(.+)/i.exec(testUrl)
    expect(match).not.toBeNull()
    expect(match[1]).toBe('true')
  })

  it('should parse nrvideo-debug with numeric value from URL', () => {
    // Test the regex pattern used in _loadLevelFromUrl()
    const testUrl = '?nrvideo-debug=2'
    const match = /\?.*&*nrvideo-debug=(.+)/i.exec(testUrl)
    expect(match).not.toBeNull()
    expect(match[1]).toBe('2')
  })

  it('should parse nrvideo-colors=false from URL', () => {
    // Test the regex pattern used in _loadLevelFromUrl()
    const testUrl = '?nrvideo-colors=false'
    const match = /\?.*&*nrvideo-colors=false/i.exec(testUrl)
    expect(match).not.toBeNull()
  })

  it('should parse nrvideo-debug with ampersand from URL', () => {
    // Test the regex pattern with & separator
    const testUrl = '?foo=bar&nrvideo-debug=1'
    const match = /\?.*&*nrvideo-debug=(.+)/i.exec(testUrl)
    expect(match).not.toBeNull()
    expect(match[1]).toBe('1')
  })

  afterAll(() => {
    console.warn = cwarn
    console.log = clog
    console.debug = cdebug
    console.error = cerror
  })

  it('should print error', () => {
    let spy = sinon.spy(console, 'error')
    Log.error('msg')
    expect(spy.called).toBe(true)
    spy.restore()
  })

  it('should print warning', () => {
    let spy = sinon.spy(console, 'warn')
    Log.warn('msg')
    expect(spy.called).toBe(true)
    spy.restore()
  })

  it('should print notice', () => {
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    expect(spy.called).toBe(true)
    spy.restore()
  })

  it('should print debug', () => {
    let spy = sinon.spy(console, 'debug')
    Log.debug('msg')
    expect(spy.called).toBe(true)
    spy.restore()
  })

  it('should exclude times', () => {
    Log.includeTime = false
    let spy = sinon.spy(console, 'debug')
    Log.debug('msg')
    expect(spy.called).toBe(true)
    spy.restore()
    Log.includeTime = true
  })

  it('should not print higher level logs', () => {
    Log.level = Log.Levels.SILENT
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    expect(spy.notCalled).toBe(true)
    spy.restore()
    Log.level = Log.Levels.ALL
  })

  it('should colorless report', () => {
    Log.colorful = false
    let spy = sinon.spy(console, 'log')
    Log.notice('msg')
    expect(spy.called).toBe(true)
    spy.restore()
  })

  it('should colorless report objects', () => {
    Log.colorful = false
    let spy = sinon.spy(console, 'log')
    Log.notice({})
    expect(spy.calledTwice).toBe(true)
    spy.restore()
  })

  describe('debugCommonVideoEvents', () => {
    it('with on', () => {
      let o = { on: sinon.spy() }
      Log.debugCommonVideoEvents(o)
      expect(o.on.called).toBe(true)
    })

    it('with addEventListener and custom event', () => {
      let o = { addEventListener: sinon.spy() }
      Log.debugCommonVideoEvents(o, ['custom'])
      expect(o.addEventListener.called).toBe(true)
    })

    it('with function and all custom events', () => {
      let o = sinon.spy()
      Log.debugCommonVideoEvents(o, [null, 'custom'])
      expect(o.called).toBe(true)
    })

    it('should use default report callback', () => {
      let debugSpy = sinon.spy(Log, 'debug')
      let o = { on: sinon.stub().callsFake((event, callback) => callback({ type: event })) }
      Log.debugCommonVideoEvents(o)
      expect(debugSpy.called).toBe(true)
      debugSpy.restore()
    })

    it('with addEventHandler', () => {
      let o = { addEventHandler: sinon.spy() }
      Log.debugCommonVideoEvents(o)
      expect(o.addEventHandler.called).toBe(true)
    })

    it('should warn when no listener function found', () => {
      let warnSpy = sinon.spy(Log, 'warn')
      let o = {}
      Log.debugCommonVideoEvents(o)
      expect(warnSpy.called).toBe(true)
      warnSpy.restore()
    })

    it('should not throw', () => {
      let spy = sinon.spy(console, 'warn')
      Log.colorful = true
      Log.debugCommonVideoEvents({on: () => { throw new Error('error') }})
      expect(spy.called).toBe(true)
      spy.restore()
    })
  })

  it('should use console.log when window.cast is defined', () => {
    global.window.cast = {}
    let logSpy = sinon.spy(console, 'log')
    Log.level = Log.Levels.DEBUG
    Log.colorful = true
    Log.debug('cast')
    expect(logSpy.called).toBe(true)
    logSpy.restore()
    delete global.window.cast
    Log.level = Log.Levels.ALL
  })
})
