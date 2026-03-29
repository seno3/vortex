'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { forwardGeocodeUrl, reverseGeocodeUrl } from '@/lib/mapboxGeocoding';
import type { Exit } from '@/types';

interface MapProps {
  threatBuildings?: Record<string, 'advisory' | 'warning' | 'critical'>;
  is3D?: boolean;
  center?: [number, number];
  locateTrigger?: number;
  showExits?: boolean;
  flyTarget?: { center: [number, number]; zoom: number } | null;
  placementMode?: boolean;
  onReady?: () => void;
  onMapClick?: (lng: number, lat: number) => void;
  onBuildingClick?: (lng: number, lat: number, buildingId: string) => void;
  onPlacementClick?: (lng: number, lat: number) => void;
  onMapRef?: (map: any, mapboxGL: any) => void;
}

declare global {
  interface Window {
    mapboxgl: typeof import('mapbox-gl');
  }
}

/** Swapped palette: extrusions use the lighter “road” tone; roads use the darker former building tone. */
const MAP_BUILDING_EXTRUSION_DEFAULT = '#52576a';
/** Lighter gray-blue for road lines (swapped palette). */
const MAP_ROAD_LINE_COLOR = '#7d8fa3';

/** Dark-v11 line layers for streets / paths — set to former building color. */
function applySwappedRoadLineColors(map: MapboxMap) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== 'line') continue;
    const id = layer.id.toLowerCase();
    if (id.includes('rail') || id.includes('aerialway') || id.includes('ferry') || id.includes('water')) continue;
    if (
      !id.includes('road') &&
      !id.includes('street') &&
      !id.includes('motorway') &&
      !id.includes('trunk') &&
      !id.includes('path') &&
      !id.includes('primary') &&
      !id.includes('secondary') &&
      !id.includes('tertiary') &&
      !id.includes('residential') &&
      !id.includes('service') &&
      !id.includes('track')
    ) {
      continue;
    }
    try {
      map.setPaintProperty(layer.id, 'line-color', MAP_ROAD_LINE_COLOR);
    } catch {
      /* layer may use line-gradient or other paint */
    }
  }
}

/** Brighter fill + stronger halo on street / building / place labels (Mapbox symbol layers). */
const LABEL_TEXT_COLOR = '#eef1f6';
const LABEL_HALO_COLOR = 'rgba(4, 8, 16, 0.92)';

function applyMapLabelReadability(map: MapboxMap) {
  const style = map.getStyle();
  if (!style?.layers) return;
  for (const layer of style.layers) {
    if (layer.type !== 'symbol') continue;
    const layout = layer.layout as Record<string, unknown> | undefined;
    if (layout?.['text-field'] == null) continue;
    const id = layer.id;
    try {
      map.setPaintProperty(id, 'text-color', LABEL_TEXT_COLOR);
      map.setPaintProperty(id, 'text-halo-color', LABEL_HALO_COLOR);
      map.setPaintProperty(id, 'text-halo-width', 1.5);
      map.setPaintProperty(id, 'text-halo-blur', 0.2);
    } catch {
      /* data-driven paint or unsupported */
    }
  }
}

export default function Map({
  threatBuildings,
  is3D,
  center,
  locateTrigger,
  showExits = true,
  flyTarget,
  placementMode = false,
  onReady,
  onMapClick,
  onBuildingClick,
  onPlacementClick,
  onMapRef,
}: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const mapboxglRef = useRef<any>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const centerRef = useRef<{ lng: number; lat: number }>({ lng: -98.5795, lat: 39.8283 });
  const userMarkerRef = useRef<mapboxgl.Marker | null>(null);
  const watchIdRef = useRef<number | null>(null);
  const markerAddedRef = useRef(false);
  const userPosRef = useRef<[number, number] | null>(null);
  /** Set after map + user marker exist; places dot and adds to map if needed. */
  const placeUserAtRef = useRef<((lng: number, lat: number) => void) | null>(null);
  const onReadyRef = useRef(onReady);
  const exitsSourceReadyRef = useRef(false);
  const currentExitsRef = useRef<Exit[]>([]);
  const placementMarkerRef = useRef<mapboxgl.Marker | null>(null);

  const syncCenter = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const c = map.getCenter();
    centerRef.current = { lng: c.lng, lat: c.lat };
  }, []);

  // Store callback refs to avoid re-running the init effect when callbacks change
  const onMapClickRef = useRef(onMapClick);
  const onBuildingClickRef = useRef(onBuildingClick);
  const onPlacementClickRef = useRef(onPlacementClick);
  const placementModeRef = useRef(placementMode);
  const threatBuildingsRef = useRef(threatBuildings);
  const onMapRefRef = useRef(onMapRef);
  useEffect(() => { onMapClickRef.current = onMapClick; }, [onMapClick]);
  useEffect(() => { onBuildingClickRef.current = onBuildingClick; }, [onBuildingClick]);
  useEffect(() => { onPlacementClickRef.current = onPlacementClick; }, [onPlacementClick]);
  useEffect(() => { onReadyRef.current = onReady; }, [onReady]);
  useEffect(() => { onMapRefRef.current = onMapRef; }, [onMapRef]);
  useEffect(() => { placementModeRef.current = placementMode; }, [placementMode]);
  useEffect(() => { threatBuildingsRef.current = threatBuildings; }, [threatBuildings]);

  // Build exit GeoJSON features from current exits + threat state
  const buildExitFeatures = useCallback((exits: Exit[]) => {
    const threats = threatBuildingsRef.current ?? {};
    return exits.map((exit, idx) => ({
      type: 'Feature' as const,
      id: idx,
      geometry: { type: 'Point' as const, coordinates: [exit.location.lng, exit.location.lat] },
      properties: {
        exitId: exit._id,
        exitType: exit.exitType,
        floor: exit.floor,
        description: exit.description ?? '',
        accessible: exit.accessible,
        status: exit.status,
        source: exit.source,
        buildingId: exit.buildingId,
        threatened: threats[exit.buildingId] === 'critical',
        label:
          exit.exitType === 'emergency' ? 'EXIT' :
          exit.exitType === 'fire_escape' ? 'FIRE' :
          exit.exitType === 'main' ? 'MAIN' : '',
      },
    }));
  }, []);

  const updateExitSource = useCallback((exits: Exit[]) => {
    const map = mapRef.current;
    if (!map || !exitsSourceReadyRef.current) return;
    const src = map.getSource('exits') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;
    currentExitsRef.current = exits;
    src.setData({ type: 'FeatureCollection', features: buildExitFeatures(exits) });
  }, [buildExitFeatures]);

  // Fetch exits for current map view (only when zoomed in)
  const fetchExits = useCallback(async () => {
    const map = mapRef.current;
    if (!map || !exitsSourceReadyRef.current) return;
    if (map.getZoom() < 15) return; // don't fetch when zoomed out
    const c = map.getCenter();
    try {
      const res = await fetch(
        `/api/exits?lng=${c.lng.toFixed(5)}&lat=${c.lat.toFixed(5)}&radius=500`,
      );
      const { exits } = await res.json() as { exits: Exit[] };
      updateExitSource(exits ?? []);
    } catch {
      // silent — exit layer is non-critical
    }
  }, [updateExitSource]);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';
    let cancelled = false;

    import('mapbox-gl').then((mapboxgl) => {
      if (cancelled || !mapContainerRef.current) return;

      mapboxglRef.current = mapboxgl.default;
      mapboxgl.default.accessToken = token;

      const map = new mapboxgl.default.Map({
        container: mapContainerRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [-98.5795, 39.8283],
        zoom: 3.5,
        pitch: 45,
        bearing: -17.6,
        antialias: true,
      });
      mapRef.current = map;

      if (cancelled) {
        map.remove();
        mapRef.current = null;
        return;
      }

      map.on('moveend', syncCenter);

      // Inject pulse keyframe once
      if (!document.getElementById('user-loc-style')) {
        const s = document.createElement('style');
        s.id = 'user-loc-style';
        s.textContent = '@keyframes userLocPulse { from { transform: scale(0.5); opacity: 0.6; } to { transform: scale(1.5); opacity: 0; } }';
        document.head.appendChild(s);
      }

      // Build custom user location marker element
      const markerEl = document.createElement('div');
      markerEl.style.cssText = 'position:relative;width:36px;height:36px;pointer-events:none;';
      const ring = document.createElement('div');
      ring.style.cssText = 'position:absolute;inset:0;border-radius:50%;border:2px solid rgba(59,130,246,0.5);animation:userLocPulse 2s ease-out infinite;';
      const dot = document.createElement('div');
      dot.style.cssText = 'position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:14px;height:14px;border-radius:50%;background:#3b82f6;border:2.5px solid #ffffff;box-shadow:0 2px 8px rgba(59,130,246,0.6);';
      markerEl.appendChild(ring);
      markerEl.appendChild(dot);

      const userMarker = new mapboxgl.default.Marker({ element: markerEl, anchor: 'center' });
      userMarkerRef.current = userMarker;

      const placeUserAt = (longitude: number, latitude: number) => {
        userPosRef.current = [longitude, latitude];
        userMarker.setLngLat([longitude, latitude]);
        if (!markerAddedRef.current) {
          userMarker.addTo(map);
          markerAddedRef.current = true;
        }
      };
      placeUserAtRef.current = placeUserAt;

      if ('geolocation' in navigator) {
        // One-shot fix is often faster than the first watchPosition callback — avoids missing dot.
        navigator.geolocation.getCurrentPosition(
          (pos) => placeUserAt(pos.coords.longitude, pos.coords.latitude),
          () => {},
          { enableHighAccuracy: true, maximumAge: 10_000 },
        );
        watchIdRef.current = navigator.geolocation.watchPosition(
          (pos) => placeUserAt(pos.coords.longitude, pos.coords.latitude),
          () => { /* denied or unavailable */ },
          { enableHighAccuracy: true },
        );
      }

      map.on('load', () => {
        if (cancelled) return;
        setMapLoaded(true);
        syncCenter();
        onMapRefRef.current?.(map, mapboxgl.default);

        // 3D buildings layer
        const layers = map.getStyle().layers;
        let labelLayerId: string | undefined;
        if (layers) {
          for (const layer of layers) {
            if (layer.type === 'symbol' && (layer.layout as any)?.['text-field']) {
              labelLayerId = layer.id;
              break;
            }
          }
        }

        map.addLayer(
          {
            id: '3d-buildings',
            source: 'composite',
            'source-layer': 'building',
            filter: ['==', 'extrude', 'true'],
            type: 'fill-extrusion',
            minzoom: 14,
            paint: {
              'fill-extrusion-color': [
                'case',
                ['boolean', ['feature-state', 'threatLevel'], false],
                '#ef4444',
                MAP_BUILDING_EXTRUSION_DEFAULT,
              ],
              'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'height']],
              'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 14, 0, 14.05, ['get', 'min_height']],
              'fill-extrusion-opacity': 0.92,
            },
          },
          labelLayerId,
        );

        applySwappedRoadLineColors(map);

        // ── Exit GeoJSON source ──────────────────────────────────────────────
        map.addSource('exits', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });
        exitsSourceReadyRef.current = true;

        // Exit circle markers
        map.addLayer({
          id: 'exit-markers',
          type: 'circle',
          source: 'exits',
          minzoom: 16,
          paint: {
            'circle-radius': [
              'case',
              ['get', 'threatened'],
              ['match', ['get', 'exitType'], 'emergency', 7, 'fire_escape', 7, 'main', 6, 5],
              ['match', ['get', 'exitType'], 'emergency', 5, 'fire_escape', 5, 'main', 4, 3],
            ],
            'circle-color': [
              'match', ['get', 'exitType'],
              'emergency', '#22c55e',
              'fire_escape', '#22c55e',
              'main', '#3b82f6',
              'service', '#6b7280',
              'staircase', '#8b5cf6',
              '#6b7280',
            ],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': [
              'case',
              ['get', 'threatened'],
              'rgba(255,255,255,0.8)',
              'rgba(255,255,255,0.4)',
            ],
            'circle-opacity': [
              'case',
              ['==', ['get', 'status'], 'active'], ['case', ['get', 'threatened'], 1.0, 0.9],
              0.4,
            ],
          },
        });

        // Exit type labels
        map.addLayer({
          id: 'exit-labels',
          type: 'symbol',
          source: 'exits',
          minzoom: 17,
          layout: {
            'text-field': ['get', 'label'],
            'text-size': 9,
            'text-offset': [0, 1.2],
            'text-anchor': 'top',
            'text-font': ['DIN Pro Medium', 'Arial Unicode MS Regular'],
          },
          paint: {
            'text-color': 'rgba(255,255,255,0.5)',
            'text-halo-color': 'rgba(0,0,0,0.8)',
            'text-halo-width': 1,
          },
        });

        applyMapLabelReadability(map);

        // Click handler — building, exit, or map
        map.on('click', (e) => {
          // Placement mode intercepts all clicks
          if (placementModeRef.current && onPlacementClickRef.current) {
            onPlacementClickRef.current(e.lngLat.lng, e.lngLat.lat);
            return;
          }

          const features = map.queryRenderedFeatures(e.point, { layers: ['3d-buildings'] });
          if (features.length > 0 && onBuildingClickRef.current) {
            const f = features[0];
            const buildingId = String(f.id ?? f.properties?.id ?? Math.random());
            onBuildingClickRef.current(e.lngLat.lng, e.lngLat.lat, buildingId);
          } else if (onMapClickRef.current) {
            onMapClickRef.current(e.lngLat.lng, e.lngLat.lat);
          }
        });

        map.on('mouseenter', '3d-buildings', () => { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', '3d-buildings', () => { map.getCanvas().style.cursor = ''; });

        // Fetch exits on moveend when zoomed in
        map.on('moveend', fetchExits);
      });
    });

    return () => {
      cancelled = true;
      exitsSourceReadyRef.current = false;
      placeUserAtRef.current = null;
      onMapRefRef.current?.(null, null);
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current);
      userMarkerRef.current?.remove();
      placementMarkerRef.current?.remove();
      markerAddedRef.current = false;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [syncCenter, fetchExits]);

  // React to is3D prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.easeTo({ pitch: is3D ? 45 : 0, bearing: is3D ? -17.6 : 0, duration: 800 });
  }, [is3D, mapLoaded]);

  // React to center prop changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !center) return;
    map.jumpTo({ center, zoom: 14 });
  }, [center, mapLoaded]);

  // Fire onReady after first idle following map load
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.once('idle', () => onReadyRef.current?.());
  }, [mapLoaded]);

  // Fly to user's current position on locate trigger; always sync the blue dot (getCurrentPosition path previously skipped the marker).
  useEffect(() => {
    if (!locateTrigger) return;
    const map = mapRef.current;
    if (!map || !mapLoaded) return;

    const fly = (lng: number, lat: number) => {
      placeUserAtRef.current?.(lng, lat);
      map.flyTo({ center: [lng, lat], zoom: 15, duration: 1200 });
    };

    if (userPosRef.current) {
      fly(userPosRef.current[0], userPosRef.current[1]);
      return;
    }

    navigator.geolocation?.getCurrentPosition(
      (pos) => fly(pos.coords.longitude, pos.coords.latitude),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0 },
    );
  }, [locateTrigger, mapLoaded]);

  // Fly to exit location
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !flyTarget) return;
    map.flyTo({ center: flyTarget.center, zoom: flyTarget.zoom, duration: 500 });
  }, [flyTarget, mapLoaded]);

  // React to threatBuildings changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !threatBuildings) return;
    if (!map.getLayer('3d-buildings')) return;
    Object.entries(threatBuildings).forEach(([buildingId, level]) => {
      try {
        map.setFeatureState(
          { source: 'composite', sourceLayer: 'building', id: buildingId },
          { threatLevel: level },
        );
      } catch {
        // Feature ID may not be available
      }
    });
    // Rebuild exit features to update `threatened` property
    if (currentExitsRef.current.length > 0) {
      updateExitSource(currentExitsRef.current);
    }
  }, [threatBuildings, mapLoaded, updateExitSource]);

  // React to showExits toggle
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !exitsSourceReadyRef.current) return;
    const visibility = showExits ? 'visible' : 'none';
    if (map.getLayer('exit-markers')) map.setLayoutProperty('exit-markers', 'visibility', visibility);
    if (map.getLayer('exit-labels')) map.setLayoutProperty('exit-labels', 'visibility', visibility);
  }, [showExits, mapLoaded]);

  // Placement mode: cursor + marker
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded) return;
    map.getCanvas().style.cursor = placementMode ? 'crosshair' : '';
  }, [placementMode, mapLoaded]);

  // Placement marker: show/hide green diamond at placed location via a DOM marker
  // This is handled externally via a ref-based API in the parent — no-op here.

  return (
    <div className="relative h-full w-full min-h-0 min-w-0">
      <div ref={mapContainerRef} className="h-full w-full min-h-0" />
      {/* Subtle edge blur — minimal strip + light blur so the frame isn’t obvious */}
      <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden">
        {(
          [
            { position: { top: 0, left: 0, right: 0, height: 22 }, mask: 'linear-gradient(to bottom, black, transparent)' },
            { position: { bottom: 0, left: 0, right: 0, height: 22 }, mask: 'linear-gradient(to top, black, transparent)' },
            { position: { top: 0, bottom: 0, left: 0, width: 18 }, mask: 'linear-gradient(to right, black, transparent)' },
            { position: { top: 0, bottom: 0, right: 0, width: 18 }, mask: 'linear-gradient(to left, black, transparent)' },
          ] as const
        ).map((edge, i) => (
          <div
            key={i}
            style={{
              position: 'absolute',
              ...edge.position,
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
              maskImage: edge.mask,
              WebkitMaskImage: edge.mask,
            }}
          />
        ))}
      </div>
      {/* Tactical overlay */}
      <div
        className="pointer-events-none absolute inset-0 z-[2]"
        style={{
          background:
            'linear-gradient(to bottom, rgba(10,14,23,0.15) 0%, transparent 15%, transparent 85%, rgba(10,14,23,0.3) 100%)',
        }}
      />
      {/* Placement mode instruction banner */}
      {placementMode && (
        <div
          style={{
            position: 'absolute',
            top: '16px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'rgba(34,197,94,0.15)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(34,197,94,0.4)',
            borderRadius: '999px',
            padding: '8px 20px',
            fontSize: '11px',
            letterSpacing: '0.2em',
            color: '#22c55e',
            fontFamily: 'ui-monospace, monospace',
            textTransform: 'uppercase',
            pointerEvents: 'none',
            zIndex: 20,
          }}
        >
          Click the exact door location on the building
        </div>
      )}
    </div>
  );
}
