import Backend from '../backend'
import Log from '../log'

/**
 * Implements a New Relic Insights API backend. For a description of what is a Backend, see {@link Backend}.
 * It must be initialized using a New Relic Account ID and an Insights API insert key.
 *
 * @example
 * let backend = new nrvideo.NRInsightsBackend("ACCOUNT ID", "API KEY")
 * nrvideo.Core.setBackend(backend)
 *
 * @extends Backend
 */
class NRInsightsBackend extends Backend {
    /**
     * Constructor, receives account ID, API Key and (optionally) an event type.
     *
     * @param {String} [accountId] Insights Account ID.
     * @param {String} [apiKey] Insights API Key.
     * @param {String} [eventType] Insights event type. Default 'BrowserVideo'.
     */
    constructor(accountId, apiKey, eventType = 'BrowserVideo') {
        super()

        /**
         * Insights account ID.
         * @private
         */
        this._accountId = accountId

        /**
         * Insights API Key.
         * @private
         */
        this._apiKey = apiKey

        /**
         * Insights event type.
         * @private
         */
        this._eventType = eventType

        /**
         * Buffer to store events.
         * @private
         */
        this._eventBuffer = []

        /**
         * Harvest timer lock.
         * @private
         */
        this._harvestLocked = false

        /**
         * Last timestamp.
         * @private
         */
        this._lastTimestamp = 0

        // Define harvest timer handler
        setInterval(() => { this.harvestHandler(NRInsightsBackend.Source.TIMER) }, 10000)
    }

    send(event, data) {
        super.send(event, data)
        if (this._eventBuffer.length < 500) {
            data = this.generateAttributes(data)
            data['eventType'] = this._eventType
            data['actionName'] = event
            // Mechanism to avoid having two events with the same timestamp
            let timestamp = Date.now()
            if (timestamp > this._lastTimestamp) {
                data['timestamp'] = timestamp
                this._lastTimestamp = timestamp
            }
            else {
                this._lastTimestamp ++
                data['timestamp'] = this._lastTimestamp
            }
            this._eventBuffer.push(data)
        }
    }

    generateAttributes(data) {
        data['pageUrl'] = window.location.href
        data['currentUrl'] = window.location.origin + window.location.pathname
        data['referrerUrl'] = document.referrer

        let OSName = "Unknown"
        if (navigator.userAgent.indexOf("Win") != -1) OSName = "Windows"
        else if (navigator.userAgent.indexOf("Android") != -1) OSName = "Android"
        else if (navigator.userAgent.indexOf("Mac") != -1) OSName = "Mac"
        else if (navigator.userAgent.match(/iPhone|iPad|iPod/i)) OSName = "iOS"
        else if (navigator.userAgent.indexOf("Linux") != -1) OSName = "Linux"
        else if (navigator.userAgent.indexOf("X11") != -1) OSName = "UNIX"
        data['userAgentOS'] = OSName

        let agentName = "Unknown"
        if (navigator.userAgent.indexOf("Chrome") != -1 ) agentName = "Chrome"
        else if (navigator.userAgent.indexOf("Firefox") != -1 ) agentName = "Firefox"
        else if (navigator.userAgent.indexOf("MSIE") != -1 ) agentName = "IE"
        else if (navigator.userAgent.indexOf("Edge") != -1 ) agentName = "Microsoft Edge"
        else if (navigator.userAgent.indexOf("Safari") != -1 ) agentName = "Safari"
        else if (navigator.userAgent.indexOf("Opera") != -1 ) agentName = "Opera"
        data['userAgentName'] = agentName

        let deviceType = "Unknown"
        if (navigator.userAgent.match(/Tablet|iPad/i)) deviceType = "Tablet"
        else if (navigator.userAgent.match(/Mobile|Windows Phone|Lumia|Android|webOS|iPhone|iPod|Blackberry|PlayBook|BB10|Opera Mini|\bCrMo\/|Opera Mobi/i)) deviceType = "Mobile"
        else if (window.cast != undefined) deviceType = "Cast"
        else deviceType = "Desktop"
        data['deviceType'] = deviceType

        return data
    }

    harvestHandler(source) {
        if (source == NRInsightsBackend.Source.TIMER && this._harvestLocked) {
            Log.debug("Harvest still locked, abort")
            return
        }

        this._harvestLocked = true

        if (this._eventBuffer.length > 0) {
            Log.debug("Push events to Insights = ", this._eventBuffer)
            this.pushEventToInsights(this._eventBuffer.pop())
        }
        else {
            this._harvestLocked = false
        }
    }

    pushEventToInsights(ev) {
        const requestOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Insert-Key': this._apiKey },
            body: JSON.stringify(ev)
        }

        const url = "https://insights-collector.newrelic.com/v1/accounts/" + this._accountId + "/events"
        fetch(url, requestOptions)
            .then(response => response.json())
            .then(data => this.insightsRequestResponse(data))
            .catch((error) => {
                Log.error('Error:', error, ev);
                // Put back the event and abort current fetch process
                this._eventBuffer.push(ev)
                this._harvestLocked = false
            });
    }

    insightsRequestResponse(data) {
        // Send next event
        this.harvestHandler(NRInsightsBackend.Source.FETCH)
    }
}

NRInsightsBackend.Source = {
    TIMER: "TIMER",
    FETCH: "FETCH"
}

export default NRInsightsBackend
