/** Build a persisted route row from the add-route form (validated). */

import { nextRouteId } from './routePersistence';

export function normalizeRouteDraft(draft, existingRoutes) {
  const route = (draft.route || '').trim().toUpperCase();
  const stop_id = (draft.stop_id || '').trim();
  const stopName = (draft.stopName || '').trim();
  const destination = (draft.destination || '').trim();
  const routeName = (draft.routeName || '').trim();
  const bound = (draft.bound || 'outbound').toLowerCase() === 'inbound' ? 'inbound' : 'outbound';
  let service_type = Number(draft.service_type);
  if (!Number.isFinite(service_type) || service_type <= 0) {
    service_type = 1;
  }
  service_type = Math.floor(service_type);

  const errors = [];
  if (!route) errors.push('Route number is required.');
  if (!stop_id) errors.push('Stop ID is required.');
  if (!stopName) errors.push('Stop display name is required.');
  if (!destination) errors.push('Destination is required.');
  if (!routeName) errors.push('Route display name is required.');

  if (errors.length) {
    return { ok: false, errors };
  }

  const id = nextRouteId(existingRoutes);

  return {
    ok: true,
    route: {
      id,
      route,
      stop_id,
      service_type,
      bound,
      direction: '',
      stopName,
      destination,
      routeName,
    },
  };
}
