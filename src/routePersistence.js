import baselineRoutes from './routes.json';

export const ROUTE_STORAGE_KEY = 'hbr_extra_routes';

const BASELINE_IDS = new Set(baselineRoutes.map((r) => r.id));

/** IDs that belong to the shipped `routes.json` (extras are persisted separately). */
export function getBaselineRouteIds() {
  return BASELINE_IDS;
}

export function nextRouteId(routes) {
  if (!routes.length) return 1;
  return Math.max(...routes.map((r) => r.id)) + 1;
}

export function parseStoredRoutes(raw) {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function loadExtraRoutesFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return [];
  }
  return parseStoredRoutes(window.localStorage.getItem(ROUTE_STORAGE_KEY));
}

/** Merge default routes.json rows with extras saved under `ROUTE_STORAGE_KEY`. */
export function loadMergedRouteConfig() {
  const extras = loadExtraRoutesFromStorage();
  return [...baselineRoutes, ...extras];
}

export function persistUserRoutes(allRoutes, baselineIds = BASELINE_IDS) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }
  const extras = allRoutes.filter((r) => !baselineIds.has(r.id));
  window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(extras));
}
