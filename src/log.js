/**
 * Static Log class
 *
 * @class
 * @static
 * @memberof nrvideo
 */
export const Log = {
  /**
   * Enum for log levels
   * @enum
   */
  Levels: {
    /** No console outputs */
    SILENT: 5,
    /** Console will show errors */
    ERROR: 4,
    /** Console will show warnings */
    WARNING: 3,
    /** Console will show notices (ie: life-cyrcle logs) */
    NOTICE: 2,
    /** Console will show debug messages. */
    DEBUG: 1,
    /** Show all messages. */
    ALL: 0
  },

  /**
   * Only logs of this imporance or higher will be shown.
   * @default nrvideo.Log.Levels.ERROR
   * @see {@link nrvideo.Log.Levels}
   */
  level: 5, // Error

  /**
   * If true, logs will be outputed with colors.
   * @default true
   */
  colorful: true,

  /**
   * If true, logs will include the time mark.
   * @default true
   */
  includeTime: true,

  /**
   * Prefix included at the start of every log.
   * @default '[New Relic]'
   */
  prefix: '[nrvideo]',

  /**
   * Sends an error console log.
   * @param {any} msg... Message to show
   */
  error: function () {
    _report([].slice.call(arguments), Log.Levels.ERROR, 'darkred')
  },

  /**
   * Sends a warning console log.
   * @param {any} msg... Message to show
   */
  warn: function () {
    _report([].slice.call(arguments), Log.Levels.WARNING, 'darkorange')
  },

  /**
   * Sends a notice console log.
   * @param {any} msg... Message to show
   */
  notice: function () {
    _report([].slice.call(arguments), Log.Levels.NOTICE, 'darkcyan')
  },

  /**
   * Sends a debug message to console.
   * @param {any} msg... Message to show
   */
  debug: function () {
    _report([].slice.call(arguments), Log.Levels.DEBUG, 'indigo')
  },

  /**
   * This utility method will add most of the HTML5 common event listeners to the player sent.
   * This common events will be listened: 'canplay', 'buffering', 'waiting', 'ended', 'play',
   * 'playing', 'pause', 'resume', 'error', 'abort', 'seek', 'seeking', 'seeked', 'stalled',
   * 'dispose', 'loadeddata', 'loadstart', 'loadedmetadata'
   *
   * Events will be reported as DEBUG level messages.
   *
   * @param {object|function} o Object to attach the events.
   * @param {array} [extraEvents]
   * An array of extra events to watch. ie:  ['timeupdate', 'progress'].
   * If the first item is null, no common events will be added.
   * @param {function} [report] Callback function called to report events.
   * Default calls Log.debug()
   */
  debugCommonVideoEvents: function (o, extraEvents, report) {
    try {
      if (Log.level <= Log.Levels.DEBUG) {
        report = report || function (e) {
          Log.debug('Event: ' + e.type)
        }

        var playerEvents = [
          'canplay', 'buffering', 'waiting', 'ended', 'play', 'playing',
          'pause', 'resume', 'error', 'abort', 'seek', 'seeking', 'seeked',
          'stalled', 'dispose', 'loadeddata', 'loadstart', 'loadedmetadata'
        ]
        if (extraEvents) {
          if (extraEvents[0] === null) {
            extraEvents.shift()
            playerEvents = extraEvents
          } else {
            playerEvents = playerEvents.concat(extraEvents)
          }
        }

        for (var i = 0; i < playerEvents.length; i++) {
          if (typeof o === 'function') {
            o.call(window, playerEvents[i], report)
          } else if (o.on) {
            o.on(playerEvents[i], report)
          } else if (o.addEventListener) {
            o.addEventListener(playerEvents[i], report)
          }
        }
      }
    } catch (err) {
      Log.warn(err)
    }
  }
}

// PRIVATE MEMBERS

/**
 * Returns a console message
 *
 * @private
 * @param {array} msg Message array, error object or array of messages.
 * @param {nrvideo.Log.Level} [level=nrvideo.Log.Levels.NOTICE] Defines the level of the error sent.
 * Only errors with higher or equal level than Log.logLevel will be displayed.
 * @param {string} [color='darkgreen'] Color of the header
 * @see {@link nrvideo.Log.level}
 */
function _report (msg, level, color) {
  level = level || Log.Levels.NOTICE
  color = color || 'darkcyan'

  var prefix = Log.prefix
  if (Log.includeTime) prefix += _getCurrentTime() + ' '
  prefix += _level2letter(level) + ':'

  // Show messages in actual console if level is enought
  if (Log.level <= level && level !== Log.Levels.SILENT) {
    if (!Log.colorful || (typeof document !== 'undefined' && document.documentMode)) {
      // document.documentMode exits only in IE
      _plainReport(msg, prefix)
    } else {
      // choose log method
      var logMethod
      if (level === Log.Levels.ERROR && console.error) {
        logMethod = console.error
      } else if (level === Log.Levels.WARNING && console.warn) {
        logMethod = console.warn
      } else if (level === Log.Levels.DEBUG && console.debug) {
        logMethod = console.debug
      } else {
        logMethod = console.log
      }

      // print message
      prefix = '%c' + prefix
      msg.splice(0, 0, prefix, 'color: ' + color)
      logMethod.apply(console, msg)
    }
  }
}

/**
 * Returns the current time in format hh:mm:ss.mmm (with trailing 0s)
 * @private
 * @return {string} Current time.
 */
function _getCurrentTime () {
  var d = new Date()
  var hh = ('0' + d.getDate()).slice(-2)
  var mm = ('0' + d.getMinutes()).slice(-2)
  var ss = ('0' + d.getSeconds()).slice(-2)
  var mmm = ('00' + d.getMilliseconds()).slice(-3)
  return '[' + hh + ':' + mm + ':' + ss + '.' + mmm + ']'
}

/**
 * Returns a console message without style
 *
 * @private
 * @param {(string|object|array)} msg Message string, object or array of messages.
 * @param {string} prefix Prefix of the message.
 */
function _plainReport (msg, prefix) {
  if (msg instanceof Array) {
    for (var m in msg) {
      _plainReport(msg[m], prefix)
    }
  } else {
    if (typeof msg === 'string') {
      console.log(prefix + ' ' + msg)
    } else {
      console.log(prefix + '↵')
      console.log(msg)
    }
  }
}

const _letters = {
  4: 'e', // Error
  3: 'w', // Warning
  2: 'n', // Notice
  1: 'd' // Debug
}

/**
 * Transforms a level to a letter to identify every message.
 * 
 * @private
 * @param {nrvideo.Log.Level} level Level of the message
 */
function _level2letter (level) {
  return _letters[level]
}

/**
 * This function is automatically executed at load.
 * Will search inside window.location.search for attribute 'nrvideo-debug=X'.
 * X can have one of these values, that will modify Log.Levels.
 * 5: SILENT,
 * 4: ERROR,
 * 3: WARNING,
 * 2: NOTICE,
 * 1: DEBUG,
 *
 * If nrvideo-colors=false is present, Log.colorful will be set to false.
 * 
 * @private
 */
function _loadLevelFromUrl () {
  if (typeof window !== 'undefined' && window.location && window.location.search) {
    var m = /\?.*&*nrvideo-debug=(.+)/i.exec(window.location.search)
    if (m !== null) {
      Log.level = m[1]
    }

    var m2 = /\?.*&*nrvideo-colors=false/i.exec(window.location.search)
    if (m2 !== null) {
      Log.colorful = false
    }
  }
}

// Execute load level
_loadLevelFromUrl()
