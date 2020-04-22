import Backend from '../backend'
import Log from '../log'

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

        // Define harvest timer handler
        setInterval(() => { this.harvestHandler(NRInsightsBackend.Source.TIMER) }, 10000)
    }

    send(event, data) {
        super.send(event, data)
        if (this._eventBuffer.length < 500) {
            data['eventType'] = this._eventType
            data['actionName'] = event
            //TODO: if 2 evens have the same timestamp, insights doesn't know how to sort them (it uses order of arrival)
            //TODO: we have to inc timestamp in this case
            data['timestamp'] = Date.now()
            this._eventBuffer.push(data)
        }
    }

    harvestHandler(source) {
        Log.debug("SOURCE = ", source)

        if (source == NRInsightsBackend.Source.TIMER && this._harvestLocked) {
            Log.debug("Harvest still locked, abort")
            return
        }

        Log.debug("Lock harvest")
        this._harvestLocked = true

        if (this._eventBuffer.length > 0) {
            Log.debug("Harvest timer. Event buffer = ", this._eventBuffer)
            this.pushEventToInsights(this._eventBuffer.pop())
        }
        else {
            Log.debug("Unlock harvest")
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
        Log.debug("INSIGHTS RESPONSE = ", data)
        // Send next event
        this.harvestHandler(NRInsightsBackend.Source.FETCH)
    }
}

NRInsightsBackend.Source = {
    TIMER: "TIMER",
    FETCH: "FETCH"
}

export default NRInsightsBackend
