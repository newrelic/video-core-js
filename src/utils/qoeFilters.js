/**
 * QoE-related buffer + cycle helpers shared by both pipelines.
 *
 * All six helpers were previously duplicated between
 *   - `browser/agent.js`           (`addEvent`, `refreshQoeKpis`)
 *   - `browser/harvestScheduler.js` (cycle filter, dirty splice, _qoeKpisUnchanged, _saveQoeKpis)
 *   - `connectedDevice/connectedDeviceHarvester.js` (same six)
 *
 * They're pure helpers — no class state. Callers pass in the buffer / snapshot
 * map / event array. Keeping them shared makes the QoE behavior one source of
 * truth across pipelines, so a fix landed once applies to both Browser and
 * Vega (and any future CAF device pipeline).
 *
 * @module utils/qoeFilters
 */

import Constants from "../constants";
import Tracker from "../tracker";

/**
 * Add an event to the buffer with QOE_AGGREGATE dedup. QOE_AGGREGATE events
 * are deduplicated by `(actionName, viewId)` so multiple players sharing one
 * harvester each get exactly one buffered QoE event per view. Non-QoE events
 * are appended as-is, preserving the emit-time `timestamp` already set by
 * `recordEvent.js`.
 *
 * @param {NrVideoEventAggregator} buffer
 * @param {object} eventObject
 * @returns {boolean} True if added/replaced.
 */
export function bufferEventWithQoeDedup(buffer, eventObject) {
  if (!eventObject) return false;
  if (eventObject.actionName === Tracker.Events.QOE_AGGREGATE) {
    if (eventObject.viewId) {
      return buffer.addOrReplaceByActionNameAndViewId(
        Tracker.Events.QOE_AGGREGATE,
        eventObject.viewId,
        eventObject
      );
    }
    return buffer.addOrReplaceByActionName(Tracker.Events.QOE_AGGREGATE, eventObject);
  }
  return buffer.add(eventObject);
}

/**
 * Update QoE KPI fields on the buffered QOE_AGGREGATE event for a given viewId.
 * Looks up the existing buffered event, merges the fresh KPI values for keys
 * listed in `Constants.QOE_KPI_KEYS`, and replaces it in the buffer. No-op if
 * no QOE_AGGREGATE event is currently buffered.
 *
 * @param {NrVideoEventAggregator} buffer
 * @param {object} freshKpis
 * @param {string} [viewId]
 */
export function refreshQoeKpisInBuffer(buffer, freshKpis, viewId) {
  if (!buffer || !freshKpis) return;
  const existing = viewId
    ? buffer.findByActionNameAndViewId(Tracker.Events.QOE_AGGREGATE, viewId)
    : buffer.findByActionName(Tracker.Events.QOE_AGGREGATE);
  if (!existing) return;
  const updated = { ...existing };
  for (const key of Constants.QOE_KPI_KEYS) {
    if (key in freshKpis) updated[key] = freshKpis[key];
  }
  if (viewId) {
    buffer.addOrReplaceByActionNameAndViewId(Tracker.Events.QOE_AGGREGATE, viewId, updated);
  } else {
    buffer.addOrReplaceByActionName(Tracker.Events.QOE_AGGREGATE, updated);
  }
}

/**
 * Cross-cycle dirty check — true iff every KPI field on `event` equals the
 * snapshot saved for that event's viewId.
 *
 * @param {Object<string, object>} snapshots - viewId → KPI snapshot
 * @param {object} event
 * @returns {boolean}
 */
export function qoeKpisUnchanged(snapshots, event) {
  const snapshot = snapshots[event.viewId];
  if (!snapshot) return false;
  for (const key of Constants.QOE_KPI_KEYS) {
    if (event[key] !== snapshot[key]) return false;
  }
  return true;
}

/**
 * Save a snapshot of an event's QoE KPI fields, keyed by viewId, for the next
 * cross-cycle dirty check.
 *
 * @param {Object<string, object>} snapshots - viewId → KPI snapshot (mutated in place)
 * @param {object} event
 */
export function saveQoeKpiSnapshot(snapshots, event) {
  const snapshot = {};
  for (const key of Constants.QOE_KPI_KEYS) {
    snapshot[key] = event[key];
  }
  snapshots[event.viewId] = snapshot;
}

/**
 * Partition drained events by the QoE-cycle filter. On a QoE cycle, all events
 * pass through. On a non-QoE cycle, QOE_AGGREGATE events are re-buffered (so
 * they ship on the next QoE cycle) and only non-QoE events are returned.
 *
 * @param {object[]} drained
 * @param {boolean} isQoeCycle
 * @param {NrVideoEventAggregator} buffer
 * @returns {object[]}
 */
export function partitionByQoeCycle(drained, isQoeCycle, buffer) {
  if (isQoeCycle) return drained;
  const filtered = [];
  for (const e of drained) {
    if (e.actionName === Tracker.Events.QOE_AGGREGATE) {
      buffer.add(e);
    } else {
      filtered.push(e);
    }
  }
  return filtered;
}

/**
 * Cross-cycle dirty splice. Walks the array in reverse and drops any
 * QOE_AGGREGATE event whose KPI fields are unchanged since the last send (so
 * we don't waste bytes shipping identical aggregates). Saves a fresh snapshot
 * for any QOE_AGGREGATE that does ship. Mutates `filtered` in place.
 *
 * @param {object[]} filtered
 * @param {Object<string, object>} snapshots - viewId → KPI snapshot (read+written)
 * @param {boolean} isForced - When true, skip the dirty check and ship every
 *   QOE_AGGREGATE regardless of KPI sameness (final flush, CONTENT_END, etc.)
 */
export function applyQoeDirtyFilter(filtered, snapshots, isForced) {
  for (let i = filtered.length - 1; i >= 0; i--) {
    const e = filtered[i];
    if (e.actionName !== Tracker.Events.QOE_AGGREGATE) continue;
    if (!isForced && qoeKpisUnchanged(snapshots, e)) {
      filtered.splice(i, 1);
    } else {
      saveQoeKpiSnapshot(snapshots, e);
    }
  }
}
