# Changelog
All notable changes to this project will be documented in this file.

## [0.10.0] - 2018/02/08
### Add
- Add `playtimeSinceLastEvent` and `totalPlaytime` as attributes.

## [0.9.3] - 2018/01/02
### Fix
- Fix `isAd` not being correctly reported.

## [0.9.2] - 2017/12/19
### Fix
- Reset `timeSinceAdStart` at `CONTENT_REQUEST`.

## [0.9.1] - 2017/11/21
### Fix
- Fix `Tracker#sendHeartbeat` not passing attributes.

### Change
- `sendXXXXX` methods from `VideoTracker` will now use `send` internally instead of `emit`.
- Added a boolean as a parameter in `VideoTracker#getRenditionShift(bool)`. If true, it will store the new rendition. This way you can call `getRenditionShift()` without disrupting `RENDITION_CHANGE` events.


## [0.9.0] - 2017/11/10
### Add
- Add `isPlayerReady` to `VideoTrackerState`.
- Add `shift` in `*_RENDITION_CHANGE` events. Will report `up` or `down` depending on the change of rendition bitrate since last change.

### Remove
- Remove `TRACKER_READY` and `PLAYER_INIT` events.
- Remove `sendPlayerInit` from `VideoTracker`.
- Remove `timeSincePlayerInit` from `VideoTrackerState`. Use `timeSinceLoad`.
- Remove `goPlayerInit` and `isPlayerReadying` from `VideoTrackerState`.

### Change
- First `HEARTBEAT` will now contain `timeSinceLastHeartbeat` counting since it was started.
- Extend events of `VideoTracker` to cover all posibilities: from `END` to `CONTENT_END` and `AD_END`.

## [0.8.0] - 2017/11/03
### Add
- Add `adCreativeId`, `adPartner` and `contentId/adId` attributes.

## [0.7.0] - 2017/11/02
### Add
- Add `numberOfVideos` attribute, it shows the amount of videos reproduced.

### Fix
- Fix a bug with `viewId` being incremented ad `CONTENT_START` instead on on `CONTENT_REQUEST`.

## [0.6.1] - 2017/10/17
### Add
- Add `addEventHandler` to `Log.debugCommonVideoEvents`.

## [0.6.0] - 2017/10/16
### Change
- Move `heartbeat` support from `VideoTracker` to `Tracker`.

### Fix
- Fix minnor bug with `Tracker` class not reporting `customData`.

## [0.5.0] - 2017/09/28
### Add
- `viewSession` attribute.
- `VideoTrackerState#goViewCountUp` to increment `viewCount`.

### Fix
- `viewCount` going up BEFORE `CONTENT_END` is sent.

### Remove
- `VideoTracker#getViewId`.

## [0.4.4] - 2017/09/28
### Fix
- `VideoTracker` not reporting user-defined attributes correctly.

## [0.4.3] - 2017/09/26
### Add
- Expose `Chrono` class.

## [0.4.2] - 2017/09/26
### Change
- Changed `timeSinceTrackerReady` behaviour.

### Fix
- `TrackerState` class not found error. 

## [0.4.1] - 2017/09/26
### Change
- Move `getTrackerName` and `getTrackerVersion` from `VideoTracker` to `Tracker` class.

## [0.4.0] - 2017/09/26
### Change
- Rename `Tracker` to `VideoTracker` and `TrackerState` to `VideoTrackerState`.
- Create a new `Tracker` intermediate class between `Emitter` and `VideoTracker` to provide support for non-video platforms.

## [0.3.1] - 2017/09/20
### Added
- Add `coreVersion` as attribute for all events.

## [0.3.0] - 2017/09/19
### Added
- Add `getHeartbeat` for `Tracker` class.

### Change
- Set default hearbeat to 30s.

## [0.2.1] - 2017/09/19
## Change
- If you do not define a heartbeat for an adsTracker, it will take its parent value.

## [0.2.0] - 2017/09/18
### Add
- Add `setOptions` for `Tracker` class.

## [0.1.3] - 2017/09/12
### Fix
- Stop heartbeat when disposing.

## [0.1.2] - 2017/08/28
### Remove
- Remove `adIsFullscreen`, `adIsAutoplayed`, `adIsLive`, `adPlayrate` and `adPreload` attributes from ad events.

## [0.1.1] - 2017/08/23
### Fix
- `Tracker#sendXXXXX` methods, now they distinguish between ads and no ads for `timeSinceXXXX` attrs.

### Added
- Add `CONTRIBUTING.md` file

## [0.1.0] - 2017/08/06
- First Version
