/**
 * Simple event system for incident state changes.
 * Used to notify the sidebar when incidents are modified so the badge updates immediately.
 */

const INCIDENT_CHANGED_EVENT = 'oncallshift:incident-changed';

/**
 * Dispatch an event indicating that an incident state has changed.
 * Call this after acknowledging, resolving, or creating incidents.
 */
export function notifyIncidentChanged(): void {
  window.dispatchEvent(new CustomEvent(INCIDENT_CHANGED_EVENT));
}

/**
 * Subscribe to incident change events.
 * Returns an unsubscribe function.
 */
export function onIncidentChanged(callback: () => void): () => void {
  window.addEventListener(INCIDENT_CHANGED_EVENT, callback);
  return () => window.removeEventListener(INCIDENT_CHANGED_EVENT, callback);
}
