# New Relic Video Core - JavaScript

[![npm version](https://img.shields.io/npm/v/@newrelic/video-core.svg)](https://www.npmjs.com/package/@newrelic/video-core)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

The **New Relic Video Core** library (`@newrelic/video-core`) is the foundational framework for video trackers in the New Relic ecosystem. It provides the core classes, state management, event harvesting, and data transmission pipeline that player-specific trackers extend. The library supports two harvester pipelines:

- **Browser pipeline** — ships events to `bam.nr-data.net` via the standard Browser collector (license key auth). Used by web-based players.
- **Connected-device pipeline** — ships events to `mobile-collector.newrelic.com` via the mobile collector. Used by Vega apps and other connected-device platforms.

Events are categorized into four distinct types:

| Event Type | Description |
|---|---|
| `VideoAction` | Content playback events (play, pause, seek, buffer, etc.) |
| `VideoAdAction` | Ad-related events (ad start, end, quartile, break, etc.) |
| `VideoErrorAction` | Error events (content errors, ad errors, crashes) |
| `VideoCustomAction` | Custom events defined by the integrator |

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
  - [Info Object (Required)](#info-object-required)
  - [Config Object (Optional)](#config-object-optional)
- [Exposed API](#exposed-api)
  - [Core](#core)
  - [VideoTracker](#videotracker)
  - [Tracker](#tracker)
  - [Emitter](#emitter)
  - [VideoTrackerState](#videotrackerstate)
  - [Chrono](#chrono)
  - [Log](#log)
  - [Constants](#constants)
- [Building a Custom Tracker](#building-a-custom-tracker)
- [Tracker Methods Reference](#tracker-methods-reference)
- [Getter Methods (Override These)](#getter-methods-override-these)
- [Quality of Experience (QoE)](#quality-of-experience-qoe)
- [Obfuscation Rules](#obfuscation-rules)
- [Build & Development](#build--development)
- [Distribution Formats](#distribution-formats)
- [Testing](#testing)
- [Data Model](#data-model)
- [License](#license)

---

## Installation

```bash
npm install @newrelic/video-core
```

Or include directly via UMD:

```html
<script src="dist/umd/nrvideo.min.js"></script>
```

## Quick Start

```javascript
import nrvideo from '@newrelic/video-core';

// 1. Define a custom tracker by extending VideoTracker
class MyPlayerTracker extends nrvideo.VideoTracker {
  getTrackerName() { return 'my-player'; }
  getSrc() { return this.player.currentSrc; }
  getDuration() { return this.player.duration; }
  getPlayhead() { return this.player.currentTime; }
  getRenditionWidth() { return this.player.videoWidth; }
  getRenditionHeight() { return this.player.videoHeight; }

  registerListeners() {
    this.player.addEventListener('play', () => this.sendRequest());
    this.player.addEventListener('playing', () => this.sendStart());
    this.player.addEventListener('pause', () => this.sendPause());
    this.player.addEventListener('ended', () => this.sendEnd());
    this.player.addEventListener('waiting', () => this.sendBufferStart());
    this.player.addEventListener('seeking', () => this.sendSeekStart());
    this.player.addEventListener('seeked', () => this.sendSeekEnd());
    this.player.addEventListener('error', () => this.sendError({
      errorName: this.player.error?.message,
      errorCode: this.player.error?.code
    }));
  }

  unregisterListeners() {
    // Remove all listeners added in registerListeners
  }
}

// 2. Configure and register the tracker
const options = {
  info: {
    licenseKey: 'YOUR_LICENSE_KEY',
    beacon: 'bam.nr-data.net',
    applicationID: 'YOUR_APPLICATION_ID',
  },
  config: {
    qoeAggregate: true,
  },
};

const player = document.getElementById('myPlayer');
const tracker = new MyPlayerTracker(player, options);

// 3. Add tracker to Core to begin reporting
nrvideo.Core.addTracker(tracker, options);
```

## Configuration

The `options` object passed to `Core.addTracker()` consists of two parts:

### Getting Your Configuration

Before initializing the tracker, obtain your New Relic configuration:

1. Log in to [one.newrelic.com](https://one.newrelic.com)
2. Navigate to the video agent onboarding flow
3. Copy your credentials: `licenseKey`, `beacon`, and `applicationId`

### Info Object (Required)

Obtained through the New Relic onboarding process. Two configuration modes are supported:

**Mode 1 — With Application ID and Beacon:**

```javascript
info: {
  licenseKey: 'YOUR_LICENSE_KEY',      // Required
  applicationID: 'YOUR_APPLICATION_ID', // Required
  beacon: 'bam.nr-data.net',            // Required when applicationID is provided
}
```

**Mode 2 — With App Name and Region:**

```javascript
info: {
  licenseKey: 'YOUR_LICENSE_KEY', // Required
  appName: 'My Video App',       // Required when no applicationID
  region: 'US',                   // Required when no applicationID
}
```

**Valid Beacon Endpoints:**

| Region | Beacon |
|---|---|
| US | `bam.nr-data.net`, `bam-cell.nr-data.net` |
| EU | `bam.eu01.nr-data.net` |
| Staging | `staging-bam-cell.nr-data.net` |
| GOV | `gov-bam.nr-data.net` |

**Mode 3 — Vega / Connected-Device pipeline:**

When importing from the `/vega` subpath (`@newrelic/video-core/vega` or any player package's `/vega`), the `info` object uses a different shape — `applicationToken` + `endpoint` instead of license key + beacon, plus an optional `deviceInfo` block carrying runtime device identity:

```javascript
info: {
  accountId:        '1',                   // Required
  applicationToken: 'AA...NRMA',           // Required — NRMA token for mobile collector
  endpoint:         'US',                  // Required — 'US' | 'EU' | 'staging'
  deviceInfo: {                            // Optional — all sub-fields optional
    uuid:               'AQVV01P',         // device identifier
    osVersion:          '1.4.0',           // OS version string
    deviceModel:        'AQVV01P',         // device model code
    deviceManufacturer: 'Amazon',
    osBuild:            'PS7649/1976N',    // OS build identifier
    appBuild:           '601646782',       // app build number
    architecture:       'aarch64',
  },
}
```

On Vega, source these from `@amazon-devices/react-native-device-info`:

```js
import {
  getDeviceId, getSystemVersion, getModel, getBrand,
  getBuildIdSync, getBuildNumber,
} from '@amazon-devices/react-native-device-info';

const deviceInfo = {
  uuid:               getDeviceId(),
  osVersion:          getSystemVersion(),
  deviceModel:        getModel(),
  deviceManufacturer: getBrand(),
  osBuild:            getBuildIdSync(),    // OS build
  appBuild:           getBuildNumber(),    // app build
  architecture:       'aarch64',
};
```


### Config Object (Optional)

| Option | Type | Default | Description |
|---|---|---|---|
| `qoeAggregate` | `boolean` | `true` | Enable Quality of Experience event aggregation. QoE is enabled out of the box; set to `false` to disable. |
| `qoeIntervalFactor` | `number` | `2` | Include QoE aggregate events once every N harvest cycles. Must be a positive integer. QoE events are always sent on the first and final harvest cycles. |
| `obfuscate` | `array` | `[]` | Regex-based rules to mask sensitive data before transmission. See [Obfuscation Rules](#obfuscation-rules). |

---

## Exposed API

All exports are available under the `nrvideo` namespace (UMD) or as named imports:

```javascript
import nrvideo from '@newrelic/video-core';

// Available: nrvideo.Core, nrvideo.VideoTracker, nrvideo.Tracker,
//            nrvideo.Emitter, nrvideo.VideoTrackerState, nrvideo.Chrono,
//            nrvideo.Log, nrvideo.Constants, nrvideo.version,
//            nrvideo.NrVideoEventAggregator, nrvideo.RetryQueueHandler,
//            nrvideo.OptimizedHttpClient, nrvideo.HarvestScheduler,
//            nrvideo.recordEvent
```

### Core

Static class managing tracker registration and event dispatch.

| Method | Description |
|---|---|
| `Core.addTracker(tracker, options)` | Registers a tracker and initializes video analytics config. Starts event reporting. |
| `Core.removeTracker(tracker)` | Disposes and removes a tracker. Stops its event reporting. |
| `Core.getTrackers()` | Returns the array of currently registered trackers. |
| `Core.send(eventType, actionName, data)` | Sends an event to the collector. Called internally by event handlers. |
| `Core.sendError(att)` | Sends a `VideoErrorAction` with `actionName: "ERROR"`. For external/app-level errors. |

### VideoTracker

Base class for video player trackers. Extends `Tracker`.

| Method | Description |
|---|---|
| `constructor(player, options)` | Initializes the tracker. Lifecycle: constructor → `setOptions` → `setPlayer` → `registerListeners`. |
| `setPlayer(player, tag)` | Sets the player and optional DOM element. Calls `registerListeners()`. |
| `setOptions(options)` | Configures tracker options (heartbeat, customData, adsTracker, isAd, parentTracker). |
| `setAdsTracker(tracker)` | Sets a child ad tracker. Ad events are funneled through the parent. |
| `setUserId(userId)` | Sets a user identifier included as `enduser.id` in all events. |
| `setHarvestInterval(interval)` | Updates the harvest cycle interval in milliseconds. |
| `dispose()` | Stops heartbeat, disposes ad tracker, unregisters listeners, clears references. |
| `registerListeners()` | **Override this.** Attach player event listeners and map to `send*()` methods. |
| `unregisterListeners()` | **Override this.** Detach player event listeners. |
| `getAttributes(att)` | **Do NOT override.** Collects all video/ad attributes. Use getter methods instead. |

**State-changing methods** (call these from `registerListeners`):

| Method | Event Emitted (Content / Ad) | Description |
|---|---|---|
| `sendPlayerReady(att)` | `PLAYER_READY` | Player is initialized and ready. |
| `sendRequest(att)` | `CONTENT_REQUEST` / `AD_REQUEST` | Playback has been requested. |
| `sendStart(att)` | `CONTENT_START` / `AD_START` | First frame rendered. Starts heartbeat. |
| `sendEnd(att)` | `CONTENT_END` / `AD_END` | Playback ended. Stops heartbeat. |
| `sendPause(att)` | `CONTENT_PAUSE` / `AD_PAUSE` | Playback paused. |
| `sendResume(att)` | `CONTENT_RESUME` / `AD_RESUME` | Playback resumed. |
| `sendBufferStart(att)` | `CONTENT_BUFFER_START` / `AD_BUFFER_START` | Buffering started. |
| `sendBufferEnd(att)` | `CONTENT_BUFFER_END` / `AD_BUFFER_END` | Buffering ended. |
| `sendSeekStart(att)` | `CONTENT_SEEK_START` / `AD_SEEK_START` | Seek started. |
| `sendSeekEnd(att)` | `CONTENT_SEEK_END` / `AD_SEEK_END` | Seek ended. |
| `sendError(att)` | `CONTENT_ERROR` / `AD_ERROR` | Error occurred during playback. |
| `sendRenditionChanged(att)` | `CONTENT_RENDITION_CHANGE` / `AD_RENDITION_CHANGE` | Stream quality changed. |
| `sendDownload(att)` | `DOWNLOAD` | Download event. Requires `att.state`. |
| `sendHeartbeat(att)` | `CONTENT_HEARTBEAT` / `AD_HEARTBEAT` | Sent automatically every 30s (2s for ads). |
| `sendAdBreakStart(att)` | `AD_BREAK_START` | Ad break started (ads only). |
| `sendAdBreakEnd(att)` | `AD_BREAK_END` | Ad break ended (ads only). |
| `sendAdQuartile(att)` | `AD_QUARTILE` | Ad quartile reached. Requires `att.quartile`. |
| `sendAdClick(att)` | `AD_CLICK` | Ad clicked. Requires `att.url`. |
| `sendCustom(actionName, timeSinceAttName, att)` | Custom `VideoCustomAction` | Sends a custom event with a `timeSince` attribute. |

### Tracker

Base class providing heartbeat, custom data, and attribute management. Extends `Emitter`.

| Method | Description |
|---|---|
| `setOptions(options)` | Set heartbeat interval, customData, and parentTracker. |
| `getHeartbeat()` | Returns heartbeat interval in ms. Default: 30000 (content), 2000 (ads). |
| `startHeartbeat()` | Starts the heartbeat interval. Called automatically on `sendStart`. |
| `stopHeartbeat()` | Stops the heartbeat interval. Called automatically on `sendEnd`. |
| `getAttributes(att)` | Returns base attributes (trackerName, coreVersion, isBackgroundEvent, etc.). |
| `sendVideoAction(event, att)` | Emits a `VideoAction` event. |
| `sendVideoAdAction(event, att)` | Emits a `VideoAdAction` event. |
| `sendVideoErrorAction(event, att)` | Emits a `VideoErrorAction` event. |
| `sendVideoCustomAction(event, att)` | Emits a `VideoCustomAction` event. |

### Emitter

Event system base class.

| Method | Description |
|---|---|
| `on(event, callback)` | Subscribe to an event. Use `'*'` to listen to all events. |
| `off(event, callback)` | Unsubscribe from an event. |
| `emit(eventType, event, data)` | Emit an event to all subscribers. |

### VideoTrackerState

Internal state machine managing view lifecycle, QoE KPIs, and timing.

| Property | Description |
|---|---|
| `numberOfErrors` | Error count for current view. |
| `numberOfAds` | Total ads shown. |
| `numberOfVideos` | Total videos played. |
| `totalPlaytime` | Content viewing time in ms (excludes pausing, buffering, ads). |
| `totalAdPlaytime` | Ad viewing time in ms. |
| `startupTime` | Time from `CONTENT_REQUEST` to `CONTENT_START` in ms. |
| `peakBitrate` | Maximum bitrate observed during playback. |

### Chrono

Utility class for measuring time lapses.

| Method | Description |
|---|---|
| `start()` | Start the timer. |
| `stop()` | Stop the timer and return delta. |
| `getDeltaTime()` | Get elapsed time since `start()` in ms. |
| `getDuration()` | Get accumulated duration across multiple start/stop cycles. |
| `reset()` | Reset all values. |
| `clone()` | Create a copy of the chrono. |

### Log

Static logging utility with configurable levels.

| Method | Description |
|---|---|
| `Log.error(...msg)` | Log an error. |
| `Log.warn(...msg)` | Log a warning. |
| `Log.notice(...msg)` | Log a notice. |
| `Log.debug(...msg)` | Log a debug message. |
| `Log.debugCommonVideoEvents(player, extraEvents, report)` | Attach debug listeners for common HTML5 video events. |

**Log Levels** (set via `Log.level`):

```javascript
nrvideo.Log.level = nrvideo.Log.Levels.DEBUG; // ALL, DEBUG, NOTICE, WARNING, ERROR, SILENT
```

### Constants

**General constants** (used by both pipelines):

| Constant | Value | Description |
|---|---|---|
| `Constants.AdPositions` | `{ PRE, MID, POST }` | Ad position enum. |
| `Constants.COLLECTOR` | Object | Browser beacon endpoint URLs by region. |
| `Constants.VALID_EVENT_TYPES` | Array | `['VideoAction', 'VideoAdAction', 'VideoErrorAction', 'VideoCustomAction']` |
| `Constants.MAX_PAYLOAD_SIZE` | `1048576` | Maximum payload size (1 MB). |
| `Constants.MAX_BEACON_SIZE` | `61440` | Maximum beacon size (60 KB). |
| `Constants.MAX_EVENTS_PER_BATCH` | `1000` | Maximum events per batch. |
| `Constants.INTERVAL` | `10000` | Default harvest interval (10s). |
| `Constants.QOE_KPI_KEYS` | Array | KPI field names tracked in QoE aggregates. |
| `Constants.QOE_AGGREGATE_KEYS` | Array | Metadata field names included in QoE events. |

**Connected-device constants** (named exports from `constants.js`, used by the `/vega` subpath):

| Export | Description |
|---|---|
| `MOBILE_ENDPOINT` | Production mobile collector URL (`mobile-collector.newrelic.com`). |
| `STAGING_MOBILE_ENDPOINT` | Staging mobile collector URL. |
| `NR_ENDPOINT` | Endpoint region enum: `{ US, EU, STAGING }`. |
| `DEFAULT_HARVEST_TIME` | Default harvest cadence: `60_000` ms. |
| `DEFAULT_BUFFER_SIZE` | Default buffer cap: `100` events (informational). |
| `CD_DATA_TOKENS_PAYLOAD` | `/v5/connect` request body template (positional 2-tuple). |
| `CD_DEVICE_INFO` | `/v3/data`  device-identity tuple (default Vega values). |
| `CD_METADATA` | `/v3/data` session-metadata object (default Vega values). |

---

## Building a Custom Tracker

Extend `VideoTracker` and override getter methods and listener registration:

```javascript
class MyPlayerTracker extends nrvideo.VideoTracker {
  // Required: identify your tracker
  getTrackerName() { return 'my-custom-player'; }
  getTrackerVersion() { return '1.0.0'; }

  // Override getters to return player metadata
  getVideoId() { return this.player.getContentId(); }
  getTitle() { return this.player.getTitle(); }
  getSrc() { return this.player.getSrc(); }
  getDuration() { return this.player.getDuration() * 1000; } // in ms
  getPlayhead() { return this.player.getCurrentTime() * 1000; }
  getBitrate() { return this.player.getCurrentBitrate(); }
  getRenditionName() { return this.player.getQualityLabel(); }
  getRenditionHeight() { return this.player.getVideoHeight(); }
  getRenditionWidth() { return this.player.getVideoWidth(); }
  isLive() { return this.player.isLive(); }
  isMuted() { return this.player.isMuted(); }
  isFullscreen() { return this.player.isFullscreen(); }
  getPlayrate() { return this.player.getPlaybackRate(); }
  getPlayerName() { return 'My Player'; }
  getPlayerVersion() { return this.player.version; }

  // Map player events to tracker methods
  registerListeners() {
    this.player.on('play', () => this.sendRequest());
    this.player.on('playing', () => this.sendStart());
    this.player.on('pause', () => this.sendPause());
    this.player.on('ended', () => this.sendEnd());
    this.player.on('waiting', () => this.sendBufferStart());
    this.player.on('canplay', () => this.sendBufferEnd());
    this.player.on('seeking', () => this.sendSeekStart());
    this.player.on('seeked', () => this.sendSeekEnd());
    this.player.on('error', (e) => this.sendError({
      errorName: e.message,
      errorCode: e.code
    }));
  }

  unregisterListeners() {
    this.player.off('play');
    this.player.off('playing');
    // ... remove all listeners
  }
}
```

---

## Getter Methods (Override These)

These methods return `null` by default. Override them in your tracker to provide player-specific data:

| Getter | Attribute Set | Description |
|---|---|---|
| `getVideoId()` | `contentId` / `adId` | Content or ad identifier. |
| `getTitle()` | `contentTitle` / `adTitle` | Content or ad title. |
| `getSrc()` | `contentSrc` / `adSrc` | Media source URL. |
| `getDuration()` | `contentDuration` / `adDuration` | Duration in ms. |
| `getPlayhead()` | `contentPlayhead` / `adPlayhead` | Current playback position in ms. |
| `getBitrate()` | `contentBitrate` / `adBitrate` | Current bitrate in bits/s. |
| `getManifestBitrate()` | `contentManifestBitrate` | Manifest/playlist declared bitrate in bps. |
| `getSegmentDownloadBitrate()` | `contentSegmentDownloadBitrate` | Measured bitrate from segment download in bps. |
| `getNetworkDownloadBitrate()` | `contentNetworkDownloadBitrate` | Network download throughput in bps. |
| `getRenditionName()` | `contentRenditionName` / `adRenditionName` | Quality label (e.g., "1080p"). |
| `getRenditionHeight()` | `contentRenditionHeight` / `adRenditionHeight` | Rendition height in px. |
| `getRenditionWidth()` | `contentRenditionWidth` / `adRenditionWidth` | Rendition width in px. |
| `isLive()` | `contentIsLive` | `true` if live stream. |
| `isMuted()` | `contentIsMuted` / `adIsMuted` | `true` if muted. |
| `isFullscreen()` | `contentIsFullscreen` | `true` if fullscreen. |
| `getPlayrate()` | `contentPlayrate` | Playback speed (1.0 = normal). |
| `getLanguage()` | `contentLanguage` / `adLanguage` | Language in locale notation (e.g., `en_US`). |
| `getCdn()` | `contentCdn` / `adCdn` | CDN serving the content. |
| `getFps()` | `contentFps` / `adFps` | Current frames per second. |
| `isAutoplayed()` | `contentIsAutoplayed` | `true` if autoplayed. |
| `getPreload()` | `contentPreload` | Preload attribute value. |
| `getPlayerName()` | `playerName` | Player name. |
| `getPlayerVersion()` | `playerVersion` | Player version. |
| `getAdQuartile()` | `adQuartile` | Ad quartile (0–4). |
| `getAdPosition()` | `adPosition` | Ad position (`pre`, `mid`, `post`). |
| `getAdPartner()` | `adPartner` | Ad partner (e.g., `ima`, `freewheel`). |
| `getAdCreativeId()` | `adCreativeId` | Ad creative identifier. |

---

## Quality of Experience (QoE)

QoE tracking is **enabled by default**. The library tracks and reports QoE KPI metrics as `QOE_AGGREGATE` events. To disable, set `qoeAggregate: false` in the config object. The harvest interval multiplier can be configured via `qoeIntervalFactor` (default: `2`).

| KPI | Description |
|---|---|
| `startupTime` | Time from `CONTENT_REQUEST` to `CONTENT_START` in ms. |
| `peakBitrate` | Maximum bitrate observed during playback. |
| `averageBitrate` | Playtime-weighted average bitrate in bps. |
| `totalPlaytime` | Total content viewing time in ms (excludes pausing, buffering, ads). |
| `totalRebufferingTime` | Total ms spent rebuffering (excludes initial buffering). |
| `rebufferingRatio` | `(totalRebufferingTime / totalPlaytime) × 100`. |
| `hadStartupError` | `true` if error occurred before `CONTENT_START`. |
| `hadPlaybackError` | `true` if error occurred at any time during playback. |

QoE KPIs are refreshed before each harvest drain and always included in the final harvest at `CONTENT_END`.

---

## Obfuscation Rules

Mask sensitive data in event payloads before transmission using regex-based rules:

```javascript
config: {
  obfuscate: [
    { regex: /\/user\/[^\/?"]+/, replacement: '/user/[REDACTED]' },
    { regex: /token=[^&"]+/, replacement: 'token=[MASKED]' },
  ]
}
```

| Field | Type | Description |
|---|---|---|
| `regex` | `string` \| `RegExp` | Pattern to match in the serialized JSON payload. |
| `replacement` | `string` | Replacement string for each match. |

Rules are applied sequentially — the output of one rule feeds into the next. Invalid regex patterns are skipped with a warning logged via `Log.warn`.

---

## Build & Development

```bash
# Install dependencies
npm install

# Production build
npm run build

# Development build (unminified)
npm run build:dev

# Watch mode (production)
npm run watch

# Watch mode (development)
npm run watch:dev

# Clean build artifacts
npm run clean
```

## Distribution Formats

The build produces multiple output formats including subpath exports for tree-shaking:

| Format | Path | Usage |
|---|---|---|
| **UMD** | `dist/umd/nrvideo.min.js` | `<script>` tag → `window.nrvideo` |
| **CommonJS** | `dist/cjs/index.js` | `require('@newrelic/video-core')` — both pipelines |
| **ES Module** | `dist/esm/index.js` | `import nrvideo from '@newrelic/video-core'` — both pipelines |
| **CJS Browser** | `dist/cjs/browser/index.js` | `require('@newrelic/video-core/browser')` — Browser pipeline only |
| **CJS Connected-Device** | `dist/cjs/vega/index.js` | `require('@newrelic/video-core/vega')` — connected-device pipeline only |
| **ESM Browser** | `dist/esm/browser/index.js` | `import ... from '@newrelic/video-core/browser'` |
| **ESM Connected-Device** | `dist/esm/vega/index.js` | `import ... from '@newrelic/video-core/vega'` |

### Subpath imports

Import the specific subpath to ship only the harvester chain you need. The unused pipeline is tree-shaken from the bundle.

```javascript
// Browser pipeline only — tree-shakes out the connected-device chain
import nrvideo from '@newrelic/video-core/browser';

// Connected-device pipeline only — tree-shakes out Browser harvester and harvestScheduler
import nrvideo from '@newrelic/video-core/vega';

// Both pipelines — use with the default entry
import nrvideo from '@newrelic/video-core';
```

## Testing

```bash
# Run tests with coverage
npm test
```

Tests are written using [Jest](https://jestjs.io/) and located in the `test/` directory.

---

## Data Model

For a comprehensive reference of all event types, attributes, and action names, see [DATAMODEL.md](DATAMODEL.md).

---

## License

This project is licensed under the [Apache 2.0 License](LICENSE).

---

## Support

Should you need assistance with New Relic products, you are in good hands with several support channels.

If the issue has been confirmed as a bug or is a feature request, please file a [GitHub issue](../../issues).

**Support Channels:**

- [New Relic Documentation](https://docs.newrelic.com): Comprehensive guidance for using our platform
- [New Relic Community](https://discuss.newrelic.com): The best place to engage in troubleshooting questions
- [New Relic University](https://learn.newrelic.com): A range of online training for New Relic users of every level
- [New Relic Technical Support](https://support.newrelic.com): 24/7/365 ticketed support. Read more about our Technical Support Offerings

**Additional Resources:**

- [DATAMODEL.md](DATAMODEL.md) — Complete event and attribute reference
- [DEVELOPING.md](DEVELOPING.md) — Building and testing instructions
- [CONTRIBUTING.md](CONTRIBUTING.md) — Contribution guidelines

---

## Contributing

We encourage your contributions to improve the Video Core JS library! Keep in mind that when you submit your pull request, you'll need to sign the CLA via the click-through using CLA-Assistant. You only have to sign the CLA one time per project.

If you have any questions, or to execute our corporate CLA (which is required if your contribution is on behalf of a company), drop us an email at opensource@newrelic.com.

For more details on how best to contribute, see [CONTRIBUTING.md](CONTRIBUTING.md).

---

## A Note About Vulnerabilities

As noted in our [security policy](../../security/policy), New Relic is committed to the privacy and security of our customers and their data. We believe that providing coordinated disclosure by security researchers and engaging with the security community are important means to achieve our security goals.

If you believe you have found a security vulnerability in this project or any of New Relic's products or websites, we welcome and greatly appreciate you reporting it to New Relic through our [bug bounty program](https://docs.newrelic.com/docs/security/security-privacy/information-security/report-security-vulnerabilities/).

---

## Acknowledgments

If you would like to contribute to this project, review [these guidelines](CONTRIBUTING.md).

To all contributors, we thank you! Without your contribution, this project would not be what it is today.

---

## License

The Video Core JS library is licensed under the [Apache 2.0 License](LICENSE).

The Video Core JS library also uses source code from third-party libraries. Full details on which libraries are used and the terms under which they are licensed can be found in the [third-party notices document](THIRD_PARTY_NOTICES.md).
