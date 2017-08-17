# newrelic-video-core [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com)
#### [New Relic](http://newrelic.com) video tracking core library

## Dependencies
This video monitor solutions works on top of New Relic's **Browser Agent**.

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

## NPM Commands
Remember to run ```npm install``` the first time.

Run ```npm run build``` to build the solution. You can find the output inside ```dist``` folder.

Run ```npm run watch``` to watch the files inside ```src``` and run a build everytime a file is changed.

Use ```build:dev``` and ```watch:dev``` to generate human-readable dist files.

Use ```npm run test``` to run tests and coverage.

Use ```npm run doc``` to generate documentation page.

Use ```npm run clean``` to clear any generated files.

## Code Standards
This project follows [Standard Javascript](https://standardjs.com/) specifications.

The changelog format is based on [Keep a Changelog](http://keepachangelog.com/en/1.0.0/).

This project adheres to [Semantic Versioning](http://semver.org/spec/v2.0.0.html).

### Eslint & Standard
Use eslint to help you maintain code standards:
```bash
npm i -g standard
```
