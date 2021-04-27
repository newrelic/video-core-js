# Changelog

All notable changes to this project will be documented in this file.

## [0.32.2] - 2021/04/27
### Update
Improve `totalAdPlaytime`.

## [0.32.1] - 2021/04/26
### Fix
Only put `totalAdPlaytime` on START.

## [0.32.0] - 2021/04/26
### Add
- Attribute `totalAdPlaytime`.

## [0.31.0] - 2021/02/08
### Add
- Function `state.removeTimeSinceAttribute(...)`, to remove a custom timeSince attribute.

## [0.30.0] - 2020/11/18
### Fix
- Reset `totalPlaytime` after an END.

## [0.29.0] - 2020/11/11
### Add
- Attribute `timeSinceSeekEnd` to BUFFER events.

## [0.28.0] - 2020/10/23
### Fix
- Initial bufferType when video is a live stream.

## [0.27.0] - 2020/10/20
### Fix
- Increment time margin for initial `bufferType`.

## [0.26.0] - 2020/10/08
### Fix
- When buffering happens before START, BUFFER events not being sent.

## [0.25.0] - 2020/10/02
### Add
- Attribute `isBackgroundEvent` to indicate when an event happend during the browser tab is in background.

## [0.24.0] - 2020/10/01
### Fix
- Report `bufferType` as "pause" when it happens right after a RESUME event.

## [0.23.0] - 2020/09/29
### Add
- Method `sendCustom` to send a custom action with a timeSince attribute.

## [0.22.0] - 2020/09/01
### Fix
- Use the same `bufferType` value for both BUFFER events.

## [0.21.0] - 2020/08/13
### Add
- Call `trackerInit` method when a tracker is added.

## [0.20.0] - 2020/08/11
### Add
- `bufferType` attribute to all BUFFER events.
- `timeSinceResumed` attribute to all BUFFER events.

## [0.19.0] - 2020/06/15
### Fix
- `isInitialBuffering` attribute.

## [0.18.0] - 2020/06/15
### Fix
- `adPosition`, use state.isStarted from parent tracker (contents tracker) to determine current ad position.

## [0.17.0] - 2020/05/13
### Fix
- Minor issues on CAF Receiver environment.

## [0.16.0] - 2020/04/30
### Update
- `diff` package to version 3.5.0.

## [0.15.0] - 2020/04/30
### Fix
- Updated dependencies to fix multiple vulnerabilities reported by `npm audit`.

## [0.14.0] - 2020/04/23
### Add
- Event backend system.

## [0.13.0] - 2019/12/03
### Fix
- Issue with `isInitialBuffering` attribute.

## [0.12.0] - 2019/12/02
### Add
- Add `isInitialBuffering` attribute.

## [0.11.0] - 2019/11/22
### Fix
- Fix issue with AD_BREAK_END and recovering CONTENT tracker state.

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
