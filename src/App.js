import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import './App.css';
import {
  loadMergedRouteConfig,
  persistUserRoutes,
  getBaselineRouteIds,
} from './routePersistence';
import { normalizeRouteDraft } from './routeDraft';

const KMB_BASE_URL = 'https://data.etabus.gov.hk/v1/transport/kmb';

const ROUTE_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#ea580c'];

function App() {
  const [routeConfigs, setRouteConfigs] = useState(loadMergedRouteConfig);
  const [busRoutes, setBusRoutes] = useState([]);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAddRoute, setShowAddRoute] = useState(false);
  const [formError, setFormError] = useState(null);

  /** Form controlled state for “add route” UI */
  const [draft, setDraft] = useState({
    route: '',
    stop_id: '',
    service_type: 1,
    bound: 'outbound',
    stopName: '',
    destination: '',
    routeName: '',
  });

  const stopIdCache = useRef(new Map());

  // Get stop name by ID
  const getStopNameById = useCallback(async (stopId) => {
    try {
      const response = await axios.get(`${KMB_BASE_URL}/stop/${stopId}`);
      return response.data.data;
    } catch (error) {
      console.error(`Error fetching stop name for ${stopId}:`, error.message);
      return null;
    }
  }, []);

  // Get ETA data
  const getETA = useCallback(async (stopId, route, serviceType = 1, routeId = null) => {
    try {
      const url = `${KMB_BASE_URL}/eta/${stopId}/${route}/${serviceType}`;
      const response = await axios.get(url);
      if (response.status === 200) {
        return response.data.data || [];
      }
    } catch (error) {
      // ignore network errors — caller treats as empty ETA
    }
    return [];
  }, []);

  // Find stop ID for a route, stop name, and destination
  const findStopId = useCallback(
    async (route, stopNameEn, directionDest) => {
      const cacheKey = `${route}-${stopNameEn}-${directionDest}`;
      if (stopIdCache.current.has(cacheKey)) {
        return stopIdCache.current.get(cacheKey);
      }

      const directions = ['outbound', 'inbound'];
      const serviceType = 1;
      const foundStops = [];

      for (const direction of directions) {
        try {
          const url = `${KMB_BASE_URL}/route-stop/${route}/${direction}/${serviceType}`;
          const response = await axios.get(url);

          if (response.status === 200) {
            const data = response.data;

            for (const stop of data.data || []) {
              const stopDetail = await getStopNameById(stop.stop);

              if (stopDetail && stopNameEn.toLowerCase().includes(stopDetail.name_en.toLowerCase())) {
                foundStops.push({
                  stop_id: stop.stop,
                  direction: stop.bound || (direction === 'outbound' ? 'O' : 'I'),
                  seq: stop.seq,
                  name: stopDetail.name_en,
                  service_type: serviceType,
                });
              }
            }
          }
        } catch (error) {
          if (error.response?.status !== 404) {
            console.error(`Error checking ${direction} for route ${route}:`, error.message);
          }
          continue;
        }
      }

      if (foundStops.length === 0) {
        return null;
      }

      for (const stopCandidate of foundStops) {
        try {
          const etaData = await getETA(stopCandidate.stop_id, route);
          if (etaData && etaData.length > 0) {
            for (const bus of etaData) {
              if (bus.dest_en && bus.dest_en.toLowerCase() === directionDest.toLowerCase()) {
                const result = { stopId: stopCandidate.stop_id, direction: stopCandidate.direction };
                stopIdCache.current.set(cacheKey, result);
                return result;
              }
            }
          }
        } catch (error) {
          continue;
        }
      }

      if (foundStops.length > 0) {
        const result = { stopId: foundStops[0].stop_id, direction: foundStops[0].direction };
        stopIdCache.current.set(cacheKey, result);
        return result;
      }

      return null;
    },
    [getETA, getStopNameById]
  );

  // Format ETA timestamp
  const formatETA = (etaTimestamp) => {
    if (!etaTimestamp) return null;

    const etaDate = new Date(etaTimestamp);
    const now = new Date();
    const diffMs = etaDate - now;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) {
      return 'Departed';
    } else if (diffMins === 0) {
      return 'Arriving Now';
    } else {
      return `${diffMins} min`;
    }
  };

  // Fetch bus route data
  const fetchBusRoutes = useCallback(async () => {
    try {
      const routesData = await Promise.all(
        routeConfigs.map(async (config, index) => {
          try {
            let stopId;
            let direction;
            let serviceType;

            if (config.bound) {
              direction = config.bound.toLowerCase() === 'inbound' ? 'I' : 'O';
            } else if (config.direction) {
              direction = config.direction;
            }

            if (config.stop_id && direction) {
              stopId = config.stop_id;
              serviceType = config.service_type || 1;
            } else {
              const stopInfo = await findStopId(config.route, config.stopName, config.destination);

              if (!stopInfo) {
                return {
                  id: config.id,
                  routeNumber: config.route,
                  routeName: config.routeName,
                  stopName: config.stopName,
                  nextArrivals: ['No upcoming buses'],
                  color: ROUTE_COLORS[index % ROUTE_COLORS.length],
                  error: `Could not find stop "${config.stopName}" for route ${config.route}`,
                };
              }

              stopId = stopInfo.stopId;
              direction = stopInfo.direction;
              serviceType = config.service_type || 1;
            }

            const etaData = await getETA(stopId, config.route, serviceType, config.id);

            const filteredETAs = etaData
              .filter((bus) => {
                const dirMatch = bus.dir === direction;
                const busDestLower = bus.dest_en ? bus.dest_en.toLowerCase() : '';
                const configDestLower = config.destination.toLowerCase();
                const destMatch =
                  busDestLower &&
                  (busDestLower === configDestLower ||
                    busDestLower.includes(configDestLower) ||
                    configDestLower.includes(busDestLower));
                return dirMatch && destMatch;
              })
              .slice(0, 3)
              .map((bus) => formatETA(bus.eta))
              .filter((time) => time !== null);

            return {
              id: config.id,
              routeNumber: config.route,
              routeName: config.routeName,
              stopName: config.stopName,
              nextArrivals: filteredETAs.length > 0 ? filteredETAs : ['No upcoming buses'],
              color: ROUTE_COLORS[index % ROUTE_COLORS.length],
            };
          } catch (error) {
            console.error(`Error fetching data for route ${config.route}:`, error);
            return {
              id: config.id,
              routeNumber: config.route,
              routeName: config.routeName,
              stopName: config.stopName,
              nextArrivals: ['Error loading data'],
              color: ROUTE_COLORS[index % ROUTE_COLORS.length],
              error: error.message,
            };
          }
        })
      );

      setBusRoutes(routesData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (error) {
      console.error('Error fetching bus routes:', error);
      setLoading(false);
      setLastUpdated(new Date());
      setBusRoutes(
        routeConfigs.map((config, index) => ({
          id: config.id,
          routeNumber: config.route,
          routeName: config.routeName,
          stopName: config.stopName,
          nextArrivals: ['Error loading'],
          color: ROUTE_COLORS[index % ROUTE_COLORS.length],
        }))
      );
    }
  }, [findStopId, getETA, routeConfigs]);

  // Update current time every second
  useEffect(() => {
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timeInterval);
  }, []);

  // Fetch bus data on mount and every 1 minute
  useEffect(() => {
    fetchBusRoutes();
    const interval = setInterval(() => {
      fetchBusRoutes();
    }, 60000);

    return () => clearInterval(interval);
  }, [fetchBusRoutes]);

  const handleDraftChange = (field, value) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setFormError(null);
  };

  const handleAddRouteSubmit = (e) => {
    e.preventDefault();

    const result = normalizeRouteDraft(draft, routeConfigs);

    if (!result.ok) {
      setFormError(result.errors.join(' '));
      return;
    }

    const nextRoutes = [...routeConfigs, result.route];
    persistUserRoutes(nextRoutes, getBaselineRouteIds());
    setRouteConfigs(nextRoutes);
    setFormError(null);
    setDraft({
      route: '',
      stop_id: '',
      service_type: 1,
      bound: 'outbound',
      stopName: '',
      destination: '',
      routeName: '',
    });
  };

  if (loading) {
    return (
      <div className="App">
        <div className="signage-container">
          <div style={{ textAlign: 'center', padding: '50px', color: 'rgba(255, 255, 255, 0.8)' }}>
            Loading bus routes...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      <div className="signage-container">
        <header className="signage-header">
          <div className="signage-time-container">
            <div className="signage-time">
              Current Time: {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            {lastUpdated && (
              <div className="signage-last-updated">
                • Last Updated: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
            )}
            <button
              type="button"
              className="add-route-toggle"
              aria-expanded={showAddRoute}
              onClick={() => {
                setShowAddRoute((v) => !v);
                setFormError(null);
              }}
            >
              {showAddRoute ? 'Hide add route' : 'Add route / stop'}
            </button>
          </div>
        </header>

        {showAddRoute && (
          <form className="add-route-form" onSubmit={handleAddRouteSubmit}>
            <p className="add-route-intro">
              Add a KMB arrival panel using route number, stop ID, direction and destination filtering (same
              shape as editing <code>routes.json</code>).
            </p>
            {formError && (
              <p className="add-route-error" role="alert">
                {formError}
              </p>
            )}
            <div className="add-route-grid">
              <label className="add-route-field">
                Route number
                <input
                  name="route"
                  value={draft.route}
                  onChange={(e) => handleDraftChange('route', e.target.value)}
                  placeholder="e.g. 54"
                  autoCapitalize="characters"
                  autoCorrect="off"
                />
              </label>
              <label className="add-route-field">
                Stop ID
                <input
                  name="stop_id"
                  value={draft.stop_id}
                  onChange={(e) => handleDraftChange('stop_id', e.target.value.trim())}
                  placeholder="From KMB data or maps"
                  autoCorrect="off"
                />
              </label>
              <label className="add-route-field">
                Direction
                <select name="bound" value={draft.bound} onChange={(e) => handleDraftChange('bound', e.target.value)}>
                  <option value="outbound">Outbound</option>
                  <option value="inbound">Inbound</option>
                </select>
              </label>
              <label className="add-route-field">
                Service type
                <input
                  type="number"
                  min={1}
                  step={1}
                  name="service_type"
                  value={draft.service_type}
                  onChange={(e) => handleDraftChange('service_type', e.target.value)}
                />
              </label>
              <label className="add-route-field add-route-field-span2">
                Stop display name
                <input
                  name="stopName"
                  value={draft.stopName}
                  onChange={(e) => handleDraftChange('stopName', e.target.value)}
                  placeholder="Shown on the card"
                />
              </label>
              <label className="add-route-field add-route-field-span2">
                Destination (filter)
                <input
                  name="destination"
                  value={draft.destination}
                  onChange={(e) => handleDraftChange('destination', e.target.value)}
                  placeholder="Must match ETA dest_en for this direction"
                />
              </label>
              <label className="add-route-field add-route-field-span2">
                Route display name
                <input
                  name="routeName"
                  value={draft.routeName}
                  onChange={(e) => handleDraftChange('routeName', e.target.value)}
                  placeholder="e.g. 54 Sheung Tsuen - Yuen Long"
                />
              </label>
            </div>
            <div className="add-route-actions">
              <button type="submit" className="add-route-submit">
                Add to display
              </button>
            </div>
          </form>
        )}

        <div className="routes-grid">
          {busRoutes.map((route) => (
            <div key={route.id} className="route-card" style={{ borderLeftColor: route.color }}>
              <div className="route-header">
                <div className="route-number" style={{ backgroundColor: route.color }}>
                  {route.routeNumber}
                </div>
                <div className="route-name-container">
                  <div className="route-name">{route.routeName}</div>
                  {route.stopName && <div className="route-stop-name">{route.stopName}</div>}
                </div>
              </div>

              <div className="arrivals-list">
                {route.nextArrivals && route.nextArrivals.length > 0 ? (
                  route.nextArrivals.slice(0, 3).map((arrival, index) => (
                    <div key={index} className="arrival-item">
                      <span className="arrival-time">{arrival}</span>
                      {index === 0 &&
                        arrival !== 'No upcoming buses' &&
                        !String(arrival).includes('Error') && <span className="arrival-badge">Next</span>}
                    </div>
                  ))
                ) : (
                  <div className="arrival-item">
                    <span className="arrival-time">No data available</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;
