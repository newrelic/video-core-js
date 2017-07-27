import { Emitter } from '../emitter'
import { TrackerData } from './trackerdata'
import { version } from '../../package.json'

export class Tracker extends Emitter {
  constructor (options) {
    super()
    /** Defines the version of the tracker. */
    this.version = version
    /** Defines the name of the tracker */
    this.name = 'base-tracker'

    /**
     * TrackerData instance, if you define a variable there, it will override the value gotten
     * from a getter. 
     * 
     * @example If you define tracker.data.title = 'a' and tracker.getTitle() returns 'b'. 'a' will 
     * prevail.
     * @type nrvideo.TrackerData
     */
    this.data = new TrackerData(options.data)
  }
}
