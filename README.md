# newrelic-video-core [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com)
#### [New Relic](http://newrelic.com) video tracking core library

## Dependencies
This video monitor solutions works on top of New Relic's **Browser Agent**.

## Contributing
Check [CONTRIBUTING.md]() for **NPM commands** and **contributing notes**.

## Usage
Add **scripts** inside `dist` folder to your page.

> If you want to know how to generate `dist` folder, refer to **npm commands** section.

### Registering Trackers
`nrvideo` provides a class called `Tracker` that will serve as an interface with *Browser Agent*,
allowing you to manage and send events to New Relic.

First of all, you have to add a tracker in the core class:
```javascript
// var nrvideo = require('newrelic-video-core')
var tracker = new nrvideo.Tracker()
nrvideo.Core.addTracker(tracker)
```

From this point, any event emitted by said tracker will be reported to New Relic:
```javascript
tracker.emit('EVENT', { data: 1 })
```

Of course, you may want to use built-in events for video. Luckily for you, this core library
provides an easy way of sending video-related content, using `tracker.sendXXXXX` methods.

```javascript
tracker.sendRequest() // Will send CONTENT_REQUEST
```

Search for `Tracker#sendXXXX` events in the documentation to read more about it. 
