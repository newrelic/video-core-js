# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/)
and this project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

## Unreleased

## [0.3.1] - 2017/09/20
### Add
- Added `coreVersion` as attribute for all events.

## [0.3.0] - 2017/09/19
### Add
- Added `getHeartbeat` for `Tracker` class.

### Change
- Set default hearbeat to 30s.

## [0.2.1] - 2017/09/19
## Change
- If you do not define a heartbeat for an adsTracker, it will take its parent value.

## [0.2.0] - 2017/09/18
### Add
- Added `setOptions` for `Tracker` class.

## [0.1.3] - 2017/09/12
### Fix
- Stop heartbeat when disposing.

## [0.1.2] - 2017/08/28
### Remove
- Removed `adIsFullscreen`, `adIsAutoplayed`, `adIsLive`, `adPlayrate` and `adPreload` attributes from ad events.

## [0.1.1] - 2017/08/23
### Fix
- Fixed Tracker#sendXXXXX methods, now they distinguish between ads and no ads for timeSinceXXXX atts.

### Added
- `CONTRIBUTING.md` file

## [0.1.0] - 2017/08/06
- First Version