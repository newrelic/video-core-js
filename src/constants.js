/**
 * Constants for the library.
 * @class Constants
 * @static
 */
class Constants {}

/**
 * Enum for types/positions of ads.
 * @example var type = Constants.AdPositions.PRE
 * @enum {String}
 */
Constants.AdPositions = {
  /** For ads shown before the content. */
  PRE: 'pre',
  /** For ads shown during the content. */
  MID: 'mid',
  /** For ads shown after the content. */
  POST: 'post'
}

export default Constants
