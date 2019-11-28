# newrelic-video-core [![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com)
#### [New Relic](http://newrelic.com) video tracking core library

## Dependencies
This video monitor solutions works on top of New Relic's **Browser Agent**.

## Contributing
Check [CONTRIBUTING.md](CONTRIBUTING.md) for **NPM commands** and **contributing notes**.

## Usage
Add **scripts** inside `dist` folder to your page.

> If you want to know how to generate `dist` folder, refer to **npm commands** section.

### Registering Trackers
`nrvideo` provides a class called `VideoTracker` that will serve as an interface with 
*Browser Agent*, allowing you to manage and send events to New Relic.

First of all, you have to add a tracker in the core class:
```javascript
// var nrvideo = require('newrelic-video-core')
var tracker = new nrvideo.VideoTracker()
nrvideo.Core.addTracker(tracker)
```

From this point, any event emitted by said tracker will be reported to New Relic:
```javascript
tracker.send('EVENT', { data: 1 })
```

Of course, you may want to use built-in events for video. Luckily for you, this core library
provides an easy way of sending video-related content, using `tracker.sendXXXXX` methods.

```javascript
tracker.sendRequest() // Will send CONTENT_REQUEST
```

Search for `Tracker#sendXXXX` events in the documentation to read more about it. 

## Support

New Relic has open-sourced this project. This project is provided AS-IS WITHOUT WARRANTY OR DEDICATED SUPPORT. Issues and contributions should be reported to the project here on GitHub.

We encourage you to bring your experiences and questions to the [Explorers Hub](https://discuss.newrelic.com) where our community members collaborate on solutions and new ideas.
