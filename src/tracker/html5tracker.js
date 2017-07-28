import { Tracker } from './tracker'
import { Log } from '../log'

export class Html5Tracker extends Tracker {
  getTrackerName () {
    return 'html5'
  }

  registerListeners () {
    Log.listenCommonVideoEvents(this.player)

    this.player.addEventListener('loadstart', this.onDownload.bind(this))
    this.player.addEventListener('loadedmetadata', this.onDownload.bind(this))
    this.player.addEventListener('loadeddata', this.onDownload.bind(this))
    this.player.addEventListener('canplay', this.onDownload.bind(this))
    this.player.addEventListener('play', this.onPlay.bind(this))
    this.player.addEventListener('playing', this.onPlaying.bind(this))
    this.player.addEventListener('pause', this.onPause.bind(this))
    this.player.addEventListener('resume', this.onResume.bind(this))
    this.player.addEventListener('seeking', this.onSeeking.bind(this))
    this.player.addEventListener('seeked', this.onSeeked.bind(this))
    this.player.addEventListener('error', this.onError.bind(this))
    this.player.addEventListener('ended', this.onEnded.bind(this))
  }

  unregisterListeners () {
    this.player.removeEventListener('loadstart', this.onDownload)
    this.player.removeEventListener('loadedmetadata', this.onDownload)
    this.player.removeEventListener('loadeddata', this.onDownload)
    this.player.removeEventListener('canplay', this.onDownload)
    this.player.removeEventListener('play', this.onPlay)
    this.player.removeEventListener('playing', this.onPlaying)
    this.player.removeEventListener('pause', this.onPause)
    this.player.removeEventListener('resume', this.onResume)
    this.player.removeEventListener('seeking', this.onSeeking)
    this.player.removeEventListener('seeked', this.onSeeked)
    this.player.removeEventListener('error', this.onError)
    this.player.removeEventListener('ended', this.onEnded)
  }

  onDownload (e) {
    this.sendDownload({ state: e.type })
  }

  onPlay () {}

  onPlaying () {}

  onPause () {}

  onResume () {}

  onSeeking () {}

  onSeeked () {}

  onError () {}

  onEnded () {}
}
