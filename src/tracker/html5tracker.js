import { Tracker } from './tracker'
import { Log } from '../log'
import { Util } from '../util'

export class Html5Tracker extends Tracker {
  getTrackerName () {
    return 'html5'
  }

  registerListeners () {
    Util.logAllEvents(this.player)
    // this.player.addEventListener('play', () => { Log.notice('play') })
  }
}
