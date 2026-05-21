import baselineRoutes from './routes.json';

import {
  ROUTE_STORAGE_KEY,
  persistUserRoutes,
  loadMergedRouteConfig,
  nextRouteId,
  parseStoredRoutes,
  loadExtraRoutesFromStorage,
  getBaselineRouteIds,
} from './routePersistence';

describe('routePersistence', () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.spyOn(Storage.prototype, 'setItem');
    jest.spyOn(Storage.prototype, 'getItem');
    jest.spyOn(Storage.prototype, 'removeItem');
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('nextRouteId returns 1 for empty arrays', () => {
    expect(nextRouteId([])).toBe(1);
  });

  test('parseStoredRoutes returns [] on bad JSON', () => {
    expect(parseStoredRoutes('not json')).toEqual([]);
    expect(parseStoredRoutes('{}')).toEqual([]);
  });

  test('persistUserRoutes saves only routes not present in baseline', () => {
    persistUserRoutes(
      [...baselineRoutes, { id: 999, route: 'X', routeName: 'X', mock: true }],
      getBaselineRouteIds()
    );

    expect(window.localStorage.setItem).toHaveBeenCalled();

    let savedPayload = null;
    for (let i = window.localStorage.setItem.mock.calls.length - 1; i >= 0; i--) {
      const args = window.localStorage.setItem.mock.calls[i];
      if (args[0] === ROUTE_STORAGE_KEY) {
        savedPayload = args[1];
        break;
      }
    }

    expect(savedPayload).toBeTruthy();
    const saved = JSON.parse(savedPayload);
    expect(saved.length).toBe(1);
    expect(saved[0].id).toBe(999);
  });

  test('loadMergedRouteConfig merges baseline routes with persisted extras', () => {
    const extra = [{ id: 500, route: 'TEST', routeName: 'Extra', dummy: true }];
    window.localStorage.setItem(ROUTE_STORAGE_KEY, JSON.stringify(extra));

    const merged = loadMergedRouteConfig();
    expect(merged.length).toBe(baselineRoutes.length + 1);
    expect(merged[merged.length - 1].route).toBe('TEST');
    expect(loadExtraRoutesFromStorage()).toEqual(extra);
  });
});
