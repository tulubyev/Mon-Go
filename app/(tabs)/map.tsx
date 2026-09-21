import { Platform, StyleSheet, Text, View, Pressable, ScrollView, Linking, ActivityIndicator, Alert, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, POI, RouteOption, RouteProfile } from '@/services/api';
import { MAX_CARD_WIDTH } from '@/constants/Layout';
import { useOfflineMapPack } from '@/hooks/useOfflineMapPack';
import { useOfflineRegionPacks } from '@/hooks/useOfflineRegionPacks';
import type { Region } from '@/constants/regions';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { MapLayersControl, MapCategory } from '@/components/MapLayersControl';
import { mapStyleUrlForLocale } from '@/services/mapStyle';

// v11 named exports — no default export, no setAccessToken
const MapLibreGL = Platform.OS !== 'web' ? require('@maplibre/maplibre-react-native') : null;
const Location = Platform.OS !== 'web' ? require('expo-location') : null;

export default function MapScreen() {
  if (Platform.OS === 'web') return <MapWebFallback />;
  return <MapNativeScreen />;
}

// ─── Category filter config ───────────────────────────────────────────────────
// No 'all' pseudo-entry — "all visible" is just every real category selected at
// once in the multi-select control below (MapLayersControl), same model as
// BaikalLove's map filter dropdown.
// Toggle set — these are the categories the OSM importer (TMB
// scripts/import-osm-poi.js) actually writes. museum/restaurant/cafe/hotel
// etc. from the earlier hand-curated data collapse into these buckets, so
// they were dead toggles once the country-wide import landed.
const POI_CATEGORIES: Array<{ key: string; icon: string; color: string }> = [
  { key: 'sight',         icon: '👁️', color: '#10B981' },
  { key: 'food',          icon: '🍽️', color: '#EF4444' },
  { key: 'accommodation', icon: '🏨', color: '#0EA5E9' },
  { key: 'camp',          icon: '🏕️', color: '#65A30D' },
  { key: 'transport',     icon: '🚉', color: '#64748B' },
  { key: 'safety',        icon: '🏥', color: '#DC2626' },
  { key: 'fuel',          icon: '⛽', color: '#F59E0B' },
];

// Dot colour for every category we might still see, toggle or not.
const CATEGORY_COLOR: Record<string, string> = {
  sight: '#10B981', food: '#EF4444', accommodation: '#0EA5E9', camp: '#65A30D',
  transport: '#64748B', safety: '#DC2626', fuel: '#F59E0B',
  museum: '#8B5CF6', restaurant: '#EF4444', cafe: '#F97316', hotel: '#0EA5E9',
  market: '#EC4899', recreation: '#06B6D4', user: '#015197',
};

// Sprite image name per category (see TMB scripts/gen-poi-sprite.js). The
// sheet only has the 7 real importer categories, so anything else falls back
// to the sight icon.
const SPRITE_NAMES = new Set(['sight', 'food', 'accommodation', 'camp', 'transport', 'safety', 'fuel']);
const spriteIcon = (category: string) => (SPRITE_NAMES.has(category) ? category : 'sight');

// "12 ч 12 мин" instead of the old "732 мин" — OSRM durations for cross-
// country drives run to 10+ hours.
function formatDuration(seconds: number, t: (k: string) => string) {
  const mins = Math.round(seconds / 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} ${t('map.routeMin')}`;
  return `${h} ${t('map.routeHours')} ${m} ${t('map.routeMin')}`;
}

// ─── Route stops ─────────────────────────────────────────────────────────────
// A stop is one row of the route panel. It carries a stable id because rows
// are reordered and deleted by identity rather than position, and `kind` so a
// row can read "Моё местоположение" instead of a pair of numbers.
type RouteStopKind = 'me' | 'poi' | 'map';
interface RouteStop {
  id: string;
  coord: [number, number] | null; // [lng, lat]
  label: string | null;
  kind: RouteStopKind;
}

const STOP_LETTERS = 'ABCDEFGH';
const MAX_STOPS = 8; // the endpoint takes 10; the panel stays readable at 8

let stopSeq = 0;
const emptyStop = (): RouteStop => ({ id: `stop-${++stopSeq}`, coord: null, label: null, kind: 'map' });

const stopColor = (index: number, total: number) =>
  index === 0 ? '#16A34A' : index === total - 1 ? '#DC2626' : '#015197';

function stopLabel(stop: RouteStop, t: (k: string) => string) {
  if (stop.kind === 'me') return t('map.routeMyLocation');
  if (stop.label) return stop.label;
  if (!stop.coord) return t('map.routePickOnMap');
  return `${stop.coord[1].toFixed(4)}, ${stop.coord[0].toFixed(4)}`;
}

/** Bounding box of a line in the [ne, sw] pair MapLibre's fitBounds expects. */
function lineBounds(coords: [number, number][]) {
  if (!coords.length) return null;
  let w = 180, s = 90, e = -180, n = -90;
  for (const [lng, lat] of coords) {
    if (lng < w) w = lng;
    if (lng > e) e = lng;
    if (lat < s) s = lat;
    if (lat > n) n = lat;
  }
  if (e < w || n < s) return null;
  return { ne: [e, n] as [number, number], sw: [w, s] as [number, number] };
}

// Deep links for the "open in maps" fallback. Apple Maps only exists on iOS;
// on Android its https URL just opens a browser tab, so Google is the
// default there.
function mapsOptions(lat: number, lng: number, t: (k: string) => string) {
  const google = { label: t('map.googleMaps'), url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` };
  const apple = { label: t('map.appleMaps'), url: `https://maps.apple.com/?daddr=${lat},${lng}` };
  const twoGis = { label: t('map.twoGis'), url: `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}` };
  return Platform.OS === 'ios' ? [apple, google, twoGis] : [google, twoGis];
}

// ─── Native map (iOS / Android) ───────────────────────────────────────────────
function MapNativeScreen() {
  const { t, i18n } = useTranslation();
  const CATEGORIES: MapCategory[] = POI_CATEGORIES.map(c => ({ ...c, label: t(`map.categories.${c.key}`) }));
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(POI_CATEGORIES.map(c => c.key)));
  const [selected, setSelected] = useState<POI | null>(null);
  const [userLocationVisible, setUserLocationVisible] = useState(false);
  const [userCoords, setUserCoords] = useState<[number, number] | null>(null); // [lng,lat]
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isOnline = useNetworkStatus();
  const offlinePack = useOfflineMapPack();
  const regionPacks = useOfflineRegionPacks();
  const [regionsOpen, setRegionsOpen] = useState(false);
  // Camera follows the GPS fix (heading from direction of travel) — the
  // "drive along a track" mode. Any manual pan/zoom switches it off, which
  // the SDK reports through onTrackUserLocationChange.
  const [followMe, setFollowMe] = useState(false);

  // Multi-stop routing — an in-app preview line + distance/ETA, not
  // turn-by-turn nav (that stays the external Apple/Google/2GIS deep link in
  // InfoCard). Requires connectivity: calls TMB's /api/route, which proxies
  // to a self-hosted OSRM — unlike the map/POI browsing above, this one part
  // doesn't work offline.
  //
  // Every point lives in `routeStops` as an explicit row, and exactly one row
  // is armed (`activeStopId`) — that is the row a tap on the map fills. A tap
  // used to mean start, finish or "replace the finish" depending on state
  // nothing on screen showed.
  const [routingMode, setRoutingMode] = useState(false);
  const [routeStops, setRouteStops] = useState<RouteStop[]>(() => [emptyStop(), emptyStop()]);
  const [activeStopId, setActiveStopId] = useState<string | null>(null);
  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRouteIdx, setSelectedRouteIdx] = useState(0);
  const [routeProfile, setRouteProfile] = useState<RouteProfile>('car');
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [locatingUser, setLocatingUser] = useState(false);
  const [zoom, setZoom] = useState(5); // kept in sync via Map's onRegionDidChange, incl. pinch gestures

  useEffect(() => {
    let cancelled = false;

    // Two-phase load: the full country-wide fetch always runs (needed
    // eventually regardless of location), but if a GPS fix comes back first
    // a fast nearby-only chunk paints markers around the user right away
    // instead of everyone waiting on ~13k rows to parse and render. Whoever
    // resolves first clears `loading`; the full fetch always wins once it
    // lands (nearby is a preview, not a replacement for completeness).
    const fullFetch = api.getPOI('all');
    fullFetch
      .then(all => { if (!cancelled) setPois(all); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || cancelled) return;
      setUserLocationVisible(true);
      // Also powers the "N km away" line in InfoCard — routing gets its own
      // fresh fetch when actually started (see toggleRoutingMode), since a
      // stale cached fix there could point a route from the wrong place.
      try {
        const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (cancelled) return;
        const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
        setUserCoords(coords);
        api.getPOI('all', { lat: coords[1], lng: coords[0], radiusKm: 150 })
          .then(nearby => {
            if (cancelled || !nearby.length) return;
            setPois(prev => (prev.length ? prev : nearby)); // don't clobber the full set if it already landed
            setLoading(false);
          })
          .catch(() => {});
      } catch {
        // No fix — the full fetch above is still in flight and is the fallback.
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const filtered = pois.filter(p => activeFilters.has(p.category));

  const cameraRef = useRef<any>(null);
  const poiSourceRef = useRef<any>(null);

  // One clustered GeoJSON source instead of thousands of native <Marker>
  // views — the v11 docs call Marker out as slow for large static sets, and
  // the country-wide OSM import pushed the count into the thousands.
  const poiCollection = useMemo(() => ({
    type: 'FeatureCollection' as const,
    features: filtered.map(p => ({
      type: 'Feature' as const,
      id: p.id,
      geometry: { type: 'Point' as const, coordinates: [p.lng, p.lat] },
      properties: {
        poiId: p.id,
        name: p.name,
        color: CATEGORY_COLOR[p.category] || '#015197',
        icon: spriteIcon(p.category),
      },
    })),
  }), [filtered]);

  const handlePoiPress = async (e: any) => {
    // Stop the tap also reaching Map.onPress, which would clear the selection.
    e?.stopPropagation?.();
    const ne = e?.nativeEvent ?? e;
    const feat = ne?.features?.[0];
    if (!feat) return;
    if (feat.properties?.point_count) {
      const coords = feat.geometry?.coordinates;
      let zoom = 12;
      try {
        zoom = (await poiSourceRef.current?.getClusterExpansionZoom(feat.properties.cluster_id)) ?? 12;
      } catch {}
      cameraRef.current?.flyTo?.({ center: coords, zoom, duration: 400 });
      return;
    }
    const id = feat.properties?.poiId ?? feat.id;
    const poi = pois.find(p => p.id === id);
    if (!poi) return;
    // While a route row is armed, tapping a place puts that place in the row
    // instead of opening its card — otherwise known places were the one thing
    // you could not use as a route point.
    if (routingMode && activeStopId) {
      fillStop(activeStopId, [poi.lng, poi.lat], poi.name, 'poi');
      return;
    }
    setSelected(poi);
  };

  const route = routeOptions[selectedRouteIdx] ?? null;

  // Variants the router offered but the user didn't pick, drawn grey under
  // the chosen line. OSRM only returns these for a plain A->B query.
  const altCollection = useMemo(() => {
    const others = routeOptions.filter((_, i) => i !== selectedRouteIdx);
    if (!others.length) return null;
    return {
      type: 'FeatureCollection' as const,
      features: others.map((o, i) => ({
        type: 'Feature' as const,
        id: `route-alt-${i}`,
        properties: {},
        geometry: o.geometry,
      })),
    };
  }, [routeOptions, selectedRouteIdx]);

  const fitRoute = (option: RouteOption) => {
    const b = lineBounds(option.geometry?.coordinates ?? []);
    if (!b) return;
    // Padding clears the route panel on top and the result bar + tab bar below.
    cameraRef.current?.fitBounds?.(b.ne, b.sw, [insets.top + 150, 48, tabBarHeight + 190, 48], 600);
  };

  // Re-plan whenever the stops change — including a reorder, which is the
  // whole point of via-points. Keyed on the coordinates so re-rendering for
  // an unrelated reason doesn't re-issue the request.
  const stopsKey = routeStops
    .map(s => (s.coord ? `${s.coord[0].toFixed(5)},${s.coord[1].toFixed(5)}` : '-'))
    .join('|');

  useEffect(() => {
    const coords = routeStops.map(s => s.coord).filter(Boolean) as [number, number][];
    if (coords.length < 2 || coords.length !== routeStops.length) {
      setRouteOptions([]);
      setRouteError(false);
      return;
    }
    // An edit while a request is in flight cancels it: the answer would be
    // for the previous list of stops.
    let cancelled = false;
    const ctrl = new AbortController();
    setRouteLoading(true);
    setRouteError(false);
    api.getRoute(coords.map(c => ({ lat: c[1], lng: c[0] })), routeProfile, ctrl.signal)
      .then(res => {
        if (cancelled) return;
        const options = res.routes?.length ? res.routes : [res];
        setRouteOptions(options);
        setSelectedRouteIdx(0);
        fitRoute(options[0]);
      })
      .catch(() => { if (!cancelled) setRouteError(true); })
      .finally(() => { if (!cancelled) setRouteLoading(false); });
    return () => { cancelled = true; ctrl.abort(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stopsKey, routeProfile]);

  const legLines = useMemo(() => {
    if (!route?.legs || route.legs.length < 2) return [];
    return route.legs.map((leg, i) =>
      `${STOP_LETTERS[i] ?? '•'} → ${STOP_LETTERS[i + 1] ?? '•'}   ${(leg.distanceMeters / 1000).toFixed(0)} ${t('map.routeKm')} · ${formatDuration(leg.durationSeconds, t)}`);
  }, [route, t]);

  const ZOOM_MIN = 2;
  const ZOOM_MAX = 18;
  const zoomIn = () => cameraRef.current?.zoomTo?.(Math.min(ZOOM_MAX, zoom + 1), { duration: 200 });
  const zoomOut = () => cameraRef.current?.zoomTo?.(Math.max(ZOOM_MIN, zoom - 1), { duration: 200 });

  // "Locate me" FAB — first tap: fresh fix + fly there. Second tap (already
  // centred): toggle follow mode. A fresh fix each time rather than reusing
  // userCoords, same reasoning as toggleRoutingMode: whatever's cached from
  // map-load time could be stale by the time someone actually taps this.
  const locateMe = async () => {
    if (!userLocationVisible) return;
    if (followMe) { setFollowMe(false); return; }
    setLocatingUser(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coords: [number, number] = [pos.coords.longitude, pos.coords.latitude];
      setUserCoords(coords);
      cameraRef.current?.flyTo?.({ center: coords, zoom: Math.max(zoom, 12), duration: 600 });
      setFollowMe(true);
    } catch {
      // No fix available — nothing to do, the button just stays a no-op.
    } finally {
      setLocatingUser(false);
    }
  };

  const clearRoute = () => {
    const fresh = [emptyStop(), emptyStop()];
    setRouteStops(fresh);
    setActiveStopId(fresh[0].id);
    setRouteOptions([]);
    setSelectedRouteIdx(0);
    setRouteError(false);
  };

  /** Write a point into a row and arm the next row still waiting for one. */
  const fillStop = (id: string, coord: [number, number], label: string | null, kind: RouteStopKind) => {
    const next = routeStops.map(s => (s.id === id ? { ...s, coord, label, kind } : s));
    setRouteStops(next);
    const nextEmpty = next.find(s => !s.coord);
    setActiveStopId(nextEmpty ? nextEmpty.id : null);
  };

  const addStop = () => {
    if (routeStops.length >= MAX_STOPS) return;
    const fresh = emptyStop();
    // New rows land before the finish — that is what "via" means.
    const next = [...routeStops.slice(0, -1), fresh, routeStops[routeStops.length - 1]];
    setRouteStops(next);
    setActiveStopId(fresh.id);
  };

  const removeStop = (id: string) => {
    if (routeStops.length <= 2) {
      // The two ends are the route itself; empty the row instead of dropping it.
      setRouteStops(routeStops.map(s => (s.id === id ? { ...s, coord: null, label: null, kind: 'map' } : s)));
      setActiveStopId(id);
      return;
    }
    const next = routeStops.filter(s => s.id !== id);
    setRouteStops(next);
    if (activeStopId === id) setActiveStopId(next.find(s => !s.coord)?.id ?? null);
  };

  const moveStop = (id: string, dir: -1 | 1) => {
    const i = routeStops.findIndex(s => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= routeStops.length) return;
    const next = routeStops.slice();
    [next[i], next[j]] = [next[j], next[i]];
    setRouteStops(next);
  };

  const reverseStops = () => setRouteStops([...routeStops].reverse());

  const selectRoute = (index: number) => {
    setSelectedRouteIdx(index);
    const option = routeOptions[index];
    if (option) fitRoute(option);
  };

  // A fresh fix rather than the cached `userCoords`, same reasoning as
  // locateMe: what was cached at map-load time can be far away by now.
  const useMyLocationFor = async (id: string) => {
    if (!userLocationVisible) return;
    setLocatingUser(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      fillStop(id, [pos.coords.longitude, pos.coords.latitude], null, 'me');
    } catch {
      // No fix — the row keeps waiting for a tap on the map.
    } finally {
      setLocatingUser(false);
    }
  };

  // Start a route to a specific place (InfoCard's "Маршрут сюда"). The
  // destination always lands in the last row and the start in the first, so
  // the order never depends on whether a GPS fix arrived.
  const routeTo = async (poi: POI) => {
    setSelected(null);
    setRoutingMode(true);
    setRouteOptions([]);
    setSelectedRouteIdx(0);
    setRouteError(false);
    const start = emptyStop();
    const dest: RouteStop = { ...emptyStop(), coord: [poi.lng, poi.lat], label: poi.name, kind: 'poi' };
    setRouteStops([start, dest]);
    setActiveStopId(start.id);
    if (!userLocationVisible) return;
    setLocatingUser(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRouteStops([{ ...start, coord: [pos.coords.longitude, pos.coords.latitude], kind: 'me' }, dest]);
      setActiveStopId(null);
    } catch {
      // No fix — the first row waits for a tap.
    } finally {
      setLocatingUser(false);
    }
  };

  // Turning routing on seeds the start from GPS so only the destination is
  // left to pick — falls back to picking both on the map if permission was
  // denied or the fix fails, which is common in the steppe.
  const toggleRoutingMode = async () => {
    if (routingMode) {
      setRoutingMode(false);
      clearRoute();
      return;
    }
    const fresh = [emptyStop(), emptyStop()];
    setRouteStops(fresh);
    setRouteOptions([]);
    setSelectedRouteIdx(0);
    setRouteError(false);
    setRoutingMode(true);
    setActiveStopId(fresh[0].id);
    if (!userLocationVisible) return;
    setLocatingUser(true);
    try {
      const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setRouteStops([{ ...fresh[0], coord: [pos.coords.longitude, pos.coords.latitude], kind: 'me' }, fresh[1]]);
      setActiveStopId(fresh[1].id);
    } catch {
      // No fix — the first row just waits for a tap.
    } finally {
      setLocatingUser(false);
    }
  };
  // v11 fires onPress with a NativeSyntheticEvent — the coordinate is at
  // e.nativeEvent.lngLat ([lng, lat]), not e.lngLat. Reading the wrong path
  // pushed `undefined` into routePoints: no pin dropped, then the routing
  // effect hit `undefined[1]` ("cannot convert undefined value to object").
  const handleMapPress = (e: { nativeEvent?: { lngLat?: [number, number] } }) => {
    if (!routingMode) {
      setSelected(null);
      return;
    }
    const lngLat = e?.nativeEvent?.lngLat;
    // With every row filled no row is armed, and a tap changes nothing —
    // edits go through the panel, where it is visible what is being changed.
    if (!lngLat || !activeStopId) return;
    fillStop(activeStopId, lngLat, null, 'map');
  };

  // One style file per locale (TMB/scripts/gen-map-styles.js) — the native
  // MapLibre binding has no in-place style/layer mutation API, so changing
  // language means pointing `mapStyle` at a different URL, which reloads the
  // style. All variants share the same tile source, so this doesn't affect
  // the offline pack (created once against the ru variant — see
  // useOfflineMapPack.ts).
  const mapStyle = mapStyleUrlForLocale(i18n.language);

  const { Map, Camera, UserLocation, Marker, GeoJSONSource, Layer } = MapLibreGL;

  return (
    <View style={styles.container}>
      {/* Map — v11: Map + mapStyle prop, Camera initialViewState, Marker lngLat */}
      <Map
        style={styles.map}
        mapStyle={mapStyle}
        onPress={handleMapPress}
        onRegionDidChange={(e: any) => {
          const z = e?.nativeEvent?.zoom;
          if (typeof z === 'number') setZoom(z);
        }}
      >
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [103.8467, 46.8625], zoom: 5 }}
          trackUserLocation={followMe ? 'course' : undefined}
          onTrackUserLocationChange={(e: any) => {
            // The SDK drops tracking on any manual gesture — mirror that so
            // the FAB state stays honest.
            if (!e?.nativeEvent?.trackUserLocation) setFollowMe(false);
          }}
        />
        {userLocationVisible && <UserLocation heading accuracy minDisplacement={5} />}

        {/* POIs — clustered source, colour-coded dots, tap a dot for the card */}
        <GeoJSONSource
          id="pois"
          ref={poiSourceRef}
          data={poiCollection}
          cluster
          clusterRadius={55}
          // Clusters used to hold until z13, so at every zoom people actually
          // pan around at, the map was blue circles with numbers and the
          // category emoji never appeared. Individual icons now take over
          // three zoom levels earlier.
          clusterMaxZoom={10}
          onPress={handlePoiPress}
        >
          <Layer
            id="poi-clusters"
            type="circle"
            filter={['has', 'point_count']}
            style={{
              circleColor: '#015197',
              circleOpacity: 0.9,
              circleRadius: ['step', ['get', 'point_count'], 15, 25, 20, 100, 26],
              circleStrokeWidth: 2,
              circleStrokeColor: '#fff',
            }}
          />
          <Layer
            id="poi-cluster-count"
            type="symbol"
            filter={['has', 'point_count']}
            style={{
              textField: ['get', 'point_count_abbreviated'],
              textSize: 12,
              textColor: '#fff',
              textFont: ['Noto Sans Regular'],
              textAllowOverlap: true,
              textIgnorePlacement: true,
            }}
          />
          {/* Colour halo behind the emoji so it reads against any basemap */}
          <Layer
            id="poi-halo"
            type="circle"
            filter={['!', ['has', 'point_count']]}
            style={{
              circleColor: ['get', 'color'],
              circleRadius: 15,
              circleOpacity: 0.18,
              circleStrokeWidth: 1.5,
              circleStrokeColor: ['get', 'color'],
              circleStrokeOpacity: 0.5,
            }}
          />
          <Layer
            id="poi-icon"
            type="symbol"
            filter={['!', ['has', 'point_count']]}
            style={{
              iconImage: ['get', 'icon'],
              iconSize: 0.5,
              // Clustering already thins density down to individual pins by
              // clusterMaxZoom — without these, MapLibre's collision engine
              // silently drops any icon that overlaps a neighbour, which at
              // real-world POI density left most emoji invisible and only
              // the colour halo showing (looked like plain dots).
              iconAllowOverlap: true,
              iconIgnorePlacement: true,
            }}
          />
          {/* Names under the icons. Separate layer because a zoom-dependent
              text-field can't be combined with a data-driven one in a single
              layout property — the layer's own minzoom does the job (the prop
              is lowercase in v11; minZoomLevel is silently ignored).
              Overlapping labels are dropped (no allowOverlap here) so dense
              areas stay readable; the icons themselves always stay. */}
          <Layer
            id="poi-name"
            type="symbol"
            minzoom={13}
            filter={['!', ['has', 'point_count']]}
            style={{
              textField: ['get', 'name'],
              textFont: ['Noto Sans Regular'],
              textSize: 12,
              textOffset: [0, 1.35],
              textAnchor: 'top',
              textMaxWidth: 9,
              textColor: '#1F2937',
              textHaloColor: '#FFFFFF',
              textHaloWidth: 1.6,
            }}
          />
        </GeoJSONSource>

        {/* Route pins — lettered, matching the rows of the panel */}
        {routeStops.map((stop, i) => (stop.coord ? (
          <Marker key={stop.id} id={`route-stop-${stop.id}`} lngLat={stop.coord}>
            <View style={[styles.stopPin, { backgroundColor: stopColor(i, routeStops.length) }]}>
              <Text style={styles.stopPinText}>{STOP_LETTERS[i] ?? '•'}</Text>
            </View>
          </Marker>
        ) : null))}

        {/* Unselected variants first so the chosen line draws over them */}
        {altCollection && (
          <GeoJSONSource id="route-alt-source" data={altCollection}>
            <Layer
              id="route-alt-line"
              type="line"
              style={{ lineColor: '#94A3B8', lineWidth: 3, lineOpacity: 0.75 }}
            />
          </GeoJSONSource>
        )}

        {/* Route line preview */}
        {route && (
          <GeoJSONSource id="route-source" data={route.geometry}>
            <Layer
              id="route-line"
              type="line"
              style={{ lineColor: '#015197', lineWidth: 5, lineOpacity: 0.9 }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {/* Category/layers dropdown — floats over the map, doesn't push it down */}
      <MapLayersControl
        categories={CATEGORIES}
        active={activeFilters}
        onChange={setActiveFilters}
        style={[styles.topBar, { top: insets.top + 8 }]}
      />

      {/* Loading pill — the map renders immediately regardless of POI load
          state (no full-screen blocking overlay); this corner pill shows the
          fetch is still running and disappears once it lands. It used to keep
          sitting there afterwards with an object count nobody needed. */}
      {loading && (
        <View style={[styles.countBadge, { top: insets.top + 60 }]} pointerEvents="none">
          <ActivityIndicator size="small" color="#015197" />
        </View>
      )}

      {/* Offline map pack — Mongolia has no signal outside the cities. Same
          row as the filters pill (top-left), pinned to the right edge. */}
      <OfflineMapControl pack={offlinePack} isOnline={isOnline} topOffset={insets.top + 8} />
      {/* Per-aimag detail packs (z12–13, the ones with dirt tracks) */}
      <Pressable style={[styles.regionsBadge, { top: insets.top + 8 + 30 }]} onPress={() => setRegionsOpen(true)}>
        <Text style={styles.offlineBadgeText}>🗂 {t('map.regions')}</Text>
      </Pressable>
      <RegionPacksSheet
        visible={regionsOpen}
        onClose={() => setRegionsOpen(false)}
        packs={regionPacks}
        isOnline={isOnline}
        lang={i18n.language}
      />

      {/* Zoom +/- */}
      <View style={[styles.zoomControl, { bottom: tabBarHeight + 202 }]}>
        <Pressable style={styles.zoomBtn} onPress={zoomIn} hitSlop={4}>
          <Text style={styles.zoomBtnText}>+</Text>
        </Pressable>
        <View style={styles.zoomDivider} />
        <Pressable style={styles.zoomBtn} onPress={zoomOut} hitSlop={4}>
          <Text style={styles.zoomBtnText}>−</Text>
        </Pressable>
      </View>

      {/* Centre the map on the device's own position */}
      {userLocationVisible && (
        <Pressable style={[styles.locateFab, followMe && styles.locateFabActive, { bottom: tabBarHeight + 140 }]} onPress={locateMe}>
          {locatingUser ? (
            <ActivityIndicator size="small" color="#015197" />
          ) : (
            <Ionicons name={followMe ? 'navigate' : 'locate'} size={22} color={followMe ? '#fff' : '#015197'} />
          )}
        </Pressable>
      )}

      {/* Routing FAB + hints — needs connectivity, unlike the map/POI browsing above */}
      <Pressable
        style={[styles.routeFab, routingMode && styles.routeFabActive, { bottom: tabBarHeight + 16 }]}
        onPress={toggleRoutingMode}
      >
        <Text style={styles.routeFabIcon}>🧭</Text>
      </Pressable>

      {/* Route panel — the list of stops, always showing which row a tap fills */}
      {routingMode && (
        <View style={[styles.routePanel, { top: insets.top + 8 }]}>
          <View style={styles.routePanelHead}>
            <Text style={styles.routePanelTitle}>{t('map.route')}</Text>
            {locatingUser && <ActivityIndicator size="small" color="#015197" />}
            <View style={styles.profileSwitch}>
              {(['car', 'foot'] as RouteProfile[]).map(p => (
                <Pressable
                  key={p}
                  style={[styles.profileBtn, routeProfile === p && styles.profileBtnActive]}
                  onPress={() => setRouteProfile(p)}
                  accessibilityLabel={t(p === 'car' ? 'map.routeByCar' : 'map.routeOnFoot')}
                >
                  <Ionicons
                    name={p === 'car' ? 'car' : 'walk'}
                    size={16}
                    color={routeProfile === p ? '#fff' : '#64748B'}
                  />
                </Pressable>
              ))}
            </View>
            <View style={styles.routePanelHeadBtns}>
              <Pressable onPress={reverseStops} hitSlop={8} accessibilityLabel={t('map.routeSwap')}>
                <Ionicons name="swap-vertical" size={18} color="#64748B" />
              </Pressable>
              <Pressable onPress={toggleRoutingMode} hitSlop={8} accessibilityLabel={t('map.routeRestart')}>
                <Ionicons name="close" size={18} color="#64748B" />
              </Pressable>
            </View>
          </View>

          <ScrollView style={styles.stopScroll} showsVerticalScrollIndicator={false}>
            {routeStops.map((stop, i) => {
              const armed = stop.id === activeStopId;
              return (
                <Pressable
                  key={stop.id}
                  style={[styles.stopRow, armed && styles.stopRowArmed]}
                  onPress={() => setActiveStopId(stop.id)}
                >
                  <View style={[styles.stopBadge, { backgroundColor: stopColor(i, routeStops.length) }]}>
                    <Text style={styles.stopBadgeText}>{STOP_LETTERS[i] ?? '•'}</Text>
                  </View>
                  <Text
                    style={[styles.stopLabel, !stop.coord && styles.stopLabelEmpty]}
                    numberOfLines={1}
                  >
                    {stopLabel(stop, t)}
                  </Text>
                  {userLocationVisible && (
                    <Pressable
                      onPress={() => useMyLocationFor(stop.id)}
                      hitSlop={6}
                      accessibilityLabel={t('map.routeStartFromMe')}
                    >
                      <Ionicons name="locate" size={16} color="#015197" />
                    </Pressable>
                  )}
                  {routeStops.length > 2 && (
                    <>
                      <Pressable
                        onPress={() => moveStop(stop.id, -1)}
                        hitSlop={6}
                        disabled={i === 0}
                        accessibilityLabel={t('map.routeMoveUp')}
                      >
                        <Ionicons name="chevron-up" size={16} color={i === 0 ? '#E2E8F0' : '#94A3B8'} />
                      </Pressable>
                      <Pressable
                        onPress={() => moveStop(stop.id, 1)}
                        hitSlop={6}
                        disabled={i === routeStops.length - 1}
                        accessibilityLabel={t('map.routeMoveDown')}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={i === routeStops.length - 1 ? '#E2E8F0' : '#94A3B8'}
                        />
                      </Pressable>
                    </>
                  )}
                  <Pressable
                    onPress={() => removeStop(stop.id)}
                    hitSlop={6}
                    accessibilityLabel={t('map.routeRemoveStop')}
                  >
                    <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                  </Pressable>
                </Pressable>
              );
            })}
          </ScrollView>

          {routeStops.length < MAX_STOPS ? (
            <Pressable style={styles.addStopBtn} onPress={addStop}>
              <Ionicons name="add" size={16} color="#015197" />
              <Text style={styles.addStopText}>{t('map.routeAddStop')}</Text>
            </Pressable>
          ) : (
            <Text style={styles.stopHint}>{t('map.routeMaxStops')}</Text>
          )}
        </View>
      )}

      {routingMode && (routeLoading || routeError || route) && (
        <View style={[styles.routeResult, { bottom: tabBarHeight + 76 }]}>
          <View style={styles.routeResultMain}>
            {routeLoading ? (
              <ActivityIndicator size="small" color="#015197" />
            ) : routeError ? (
              <Text style={styles.routeResultText}>{t('map.routeError')}</Text>
            ) : route ? (
              <View style={styles.routeResultFigures}>
                <Text style={styles.routeResultText}>
                  📍 {(route.distanceMeters / 1000).toFixed(1)} {t('map.routeKm')} · ⏱ {formatDuration(route.durationSeconds, t)}
                </Text>
                {legLines.map((line, i) => (
                  <Text key={i} style={styles.routeLegText}>{line}</Text>
                ))}
              </View>
            ) : null}
            <Pressable onPress={clearRoute} hitSlop={8} accessibilityLabel={t('map.routeRestart')}>
              <Text style={styles.routeResetText}>✕</Text>
            </Pressable>
          </View>

          {routeOptions.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.altRow}
            >
              {routeOptions.map((option, i) => (
                <Pressable
                  key={i}
                  style={[styles.altChip, i === selectedRouteIdx && styles.altChipActive]}
                  onPress={() => selectRoute(i)}
                >
                  <Text style={[styles.altChipText, i === selectedRouteIdx && styles.altChipTextActive]}>
                    {(option.distanceMeters / 1000).toFixed(0)} {t('map.routeKm')} · {formatDuration(option.durationSeconds, t)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
        </View>
      )}

      {/* InfoCard */}
      {selected && (
        <InfoCard poi={selected} onClose={() => setSelected(null)} bottomOffset={tabBarHeight} userCoords={userCoords} onRoute={routeTo} />
      )}
    </View>
  );
}

// ─── Offline map pack control ────────────────────────────────────────────────
function OfflineMapControl({
  pack, isOnline, topOffset,
}: {
  pack: ReturnType<typeof useOfflineMapPack>;
  isOnline: boolean;
  topOffset: number;
}) {
  const { t } = useTranslation();

  if (pack.status === 'checking') return null;

  const confirmRemove = () => {
    Alert.alert(t('map.offlineRemoveTitle'), t('map.offlineRemoveMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: pack.remove },
    ]);
  };

  if (pack.status === 'complete') {
    return (
      <Pressable style={[styles.offlineBadge, styles.offlineBadgeReady, { top: topOffset }]} onPress={confirmRemove}>
        <Text style={styles.offlineBadgeText}>✓ {t('map.offlineReady')}</Text>
      </Pressable>
    );
  }

  if (pack.status === 'downloading') {
    return (
      <View style={[styles.offlineBadge, { top: topOffset }]}>
        <Text style={styles.offlineBadgeText}>
          ⬇️ {t('map.offlineDownloading')} {pack.progress}% (~{pack.estimatedMB} MB)
        </Text>
      </View>
    );
  }

  // 'none' or 'error' — offer to (re)start. Downloading needs a live connection,
  // so hide the offer entirely while offline rather than let it fail silently.
  if (!isOnline) return null;

  return (
    <Pressable style={[styles.offlineBadge, { top: topOffset }]} onPress={pack.download}>
      <Text style={styles.offlineBadgeText}>
        ⬇️ {pack.status === 'error' ? t('map.offlineError') : t('map.offlineDownload')}
      </Text>
    </Pressable>
  );
}

// Haversine — great-circle distance in km. Fine at this scale (POI-to-user
// distances of a few hundred metres to a few hundred km); no need for an
// ellipsoidal model here.
function distanceKm(a: [number, number], lat2: number, lng2: number) {
  const [lng1, lat1] = a;
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// ─── InfoCard ─────────────────────────────────────────────────────────────────
// OSM `wikipedia` tags are "lang:Title"; turn that into a real article URL.
function wikipediaUrl(tag: string): string | null {
  const m = /^([a-z]{2,3}):(.+)$/.exec(tag.trim());
  if (!m) return null;
  return `https://${m[1]}.wikipedia.org/wiki/${encodeURIComponent(m[2].replace(/ /g, '_'))}`;
}

function InfoCard({ poi, onClose, bottomOffset, userCoords, onRoute }: {
  poi: POI; onClose: () => void; bottomOffset: number; userCoords: [number, number] | null; onRoute: (poi: POI) => void;
}) {
  const { t } = useTranslation();
  // What the place IS (museum / peak / pharmacy…) beats the 7-bucket filter
  // category; fall back to the category label when the importer had no kind.
  const kindLabel = poi.kind
    ? t(`map.kinds.${poi.kind}`, { defaultValue: t(`map.categories.${poi.category}`, { defaultValue: poi.category }) })
    : t(`map.categories.${poi.category}`, { defaultValue: poi.category });
  const distance = userCoords ? distanceKm(userCoords, poi.lat, poi.lng) : null;
  const distanceText = distance == null ? null : distance < 1 ? `${Math.round(distance * 1000)} м` : `${distance.toFixed(1)} км`;
  const wiki = poi.wikipedia ? wikipediaUrl(poi.wikipedia) : null;

  const openInMaps = () => {
    const opts = mapsOptions(poi.lat, poi.lng, t);
    Alert.alert(t('map.openIn'), undefined, [
      ...opts.map(o => ({ text: o.label, onPress: () => Linking.openURL(o.url) })),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  };

  return (
    <View style={[styles.infoCardWrapper, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.infoCard}>
        <View style={styles.infoCardHandle} />
        <View style={styles.infoCardHeader}>
          <Text style={styles.infoCardIcon}>{poi.icon || '📍'}</Text>
          <View style={styles.infoCardTitles}>
            <Text style={styles.infoCardName}>{poi.name_ru || poi.name}</Text>
            <Text style={styles.infoCardCategory}>
              {kindLabel}{poi.name_en && poi.name_en !== (poi.name_ru || poi.name) ? ` · ${poi.name_en}` : ''}
            </Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {poi.description && (
          <Text style={styles.infoCardDesc}>{poi.description}</Text>
        )}

        <View style={styles.infoCardMeta}>
          {distanceText && <InfoRow icon="📍" text={`${distanceText} ${t('map.awayFromYou')}`} />}
          {poi.address && <InfoRow icon="🏠" text={poi.address} />}
          {poi.hours && <InfoRow icon="🕐" text={poi.hours} />}
          {poi.price && <InfoRow icon="💰" text={poi.price} />}
          {poi.phone && <InfoRow icon="📞" text={poi.phone} />}
          {poi.email && <InfoRow icon="✉️" text={poi.email} />}
        </View>

        <View style={styles.infoCardActions}>
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={() => onRoute(poi)}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>🧭 {t('map.routeToHere')}</Text>
          </Pressable>
          <Pressable style={styles.actionBtn} onPress={openInMaps}>
            <Text style={styles.actionBtnText}>📍 {t('map.openInMaps')}</Text>
          </Pressable>
          {poi.phone && (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${poi.phone}`)}>
              <Text style={styles.actionBtnText}>📞 {t('map.call')}</Text>
            </Pressable>
          )}
          {poi.url && (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(poi.url!)}>
              <Text style={styles.actionBtnText}>🌐 {t('map.website')}</Text>
            </Pressable>
          )}
          {wiki && (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(wiki)}>
              <Text style={styles.actionBtnText}>📖 {t('map.wikipedia')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

// ─── Region packs sheet ───────────────────────────────────────────────────────
function RegionPacksSheet({ visible, onClose, packs, isOnline, lang }: {
  visible: boolean; onClose: () => void; packs: ReturnType<typeof useOfflineRegionPacks>; isOnline: boolean; lang: string;
}) {
  const { t } = useTranslation();
  const nameOf = (r: Region) => (lang === 'en' ? r.name.en : lang === 'mn' ? r.name.mn : r.name.ru);
  const confirmRemove = (r: Region) => {
    Alert.alert(t('map.regionDelete'), nameOf(r), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('common.delete'), style: 'destructive', onPress: () => packs.remove(r) },
    ]);
  };
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <View style={styles.sheetCard}>
          <View style={styles.infoCardHandle} />
          <Text style={styles.sheetTitle}>{t('map.regionsTitle')}</Text>
          <Text style={styles.sheetHint}>{t('map.regionsHint')}</Text>
          <FlatList
            data={packs.regions}
            keyExtractor={r => r.id}
            style={{ maxHeight: 420 }}
            renderItem={({ item }) => {
              const st = packs.stateOf(item);
              return (
                <View style={styles.regionRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.regionName}>{nameOf(item)}</Text>
                    <Text style={styles.regionMeta}>
                      {st.status === 'downloading'
                        ? `${t('map.regionDownloading')} ${st.progress}%`
                        : st.status === 'complete'
                          ? `✓ ${t('map.regionDownloaded')} · ${item.sizeMB} MB`
                          : `${t('map.regionApprox')} ${item.sizeMB} MB`}
                    </Text>
                  </View>
                  {st.status === 'complete' ? (
                    <Pressable style={styles.regionBtn} onPress={() => confirmRemove(item)}>
                      <Ionicons name="trash-outline" size={18} color="#EF4444" />
                    </Pressable>
                  ) : st.status === 'downloading' ? (
                    <ActivityIndicator size="small" color="#015197" />
                  ) : (
                    <Pressable
                      style={[styles.regionBtn, !isOnline && { opacity: 0.4 }]}
                      disabled={!isOnline}
                      onPress={() => packs.download(item)}
                    >
                      <Ionicons name="cloud-download-outline" size={20} color="#015197" />
                    </Pressable>
                  )}
                </View>
              );
            }}
          />
          <Pressable style={styles.sheetCloseBtn} onPress={onClose}>
            <Text style={styles.sheetCloseText}>{t('common.close', { defaultValue: 'OK' })}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function InfoRow({ icon, text }: { icon: string; text: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoRowIcon}>{icon}</Text>
      <Text style={styles.infoRowText}>{text}</Text>
    </View>
  );
}

// ─── Web fallback ─────────────────────────────────────────────────────────────
function MapWebFallback() {
  const { t } = useTranslation();
  const CATEGORIES: MapCategory[] = POI_CATEGORIES.map(c => ({ ...c, label: t(`map.categories.${c.key}`) }));
  const [pois, setPois] = useState<POI[]>([]);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(POI_CATEGORIES.map(c => c.key)));
  const [selected, setSelected] = useState<POI | null>(null);

  useEffect(() => { api.getPOI('all').then(setPois).catch(() => {}); }, []);

  const filtered = pois.filter(p => activeFilters.has(p.category));

  return (
    <View style={styles.container}>
      <View style={styles.webFilterBar}>
        <MapLayersControl categories={CATEGORIES} active={activeFilters} onChange={setActiveFilters} />
      </View>
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.webMapEmoji}>🗺️</Text>
        <Text style={styles.webMapTitle}>{t('map.webFallback.title')}</Text>
        <Text style={styles.webMapSub}>{t('map.webFallback.subtitle')}</Text>
      </View>
      <ScrollView style={styles.poiList}>
        {filtered.map(poi => (
          <Pressable
            key={poi.id}
            style={[styles.poiListItem, selected?.id === poi.id && styles.poiListItemActive]}
            onPress={() => setSelected(selected?.id === poi.id ? null : poi)}
          >
            <Text style={styles.poiListIcon}>{poi.icon || '📍'}</Text>
            <View style={styles.poiListText}>
              <Text style={styles.poiListName}>{poi.name_ru || poi.name}</Text>
              {poi.hours && <Text style={styles.poiListMeta}>🕐 {poi.hours}</Text>}
              {poi.price && <Text style={styles.poiListMeta}>💰 {poi.price}</Text>}
            </View>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  topBar: { position: 'absolute', left: 12, zIndex: 10 },
  webFilterBar: { padding: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', alignItems: 'flex-start' },
  countBadge: { position: 'absolute', top: 60, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  offlineBadge: { position: 'absolute', right: 12, backgroundColor: 'rgba(100,116,139,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  routeFab: {
    position: 'absolute', right: 12, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  routeFabActive: { backgroundColor: '#015197' },
  routeFabIcon: { fontSize: 24 },
  locateFab: {
    position: 'absolute', right: 12, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  zoomControl: {
    position: 'absolute', right: 12, width: 44, borderRadius: 12, overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  zoomBtn: { height: 44, alignItems: 'center', justifyContent: 'center' },
  zoomBtnText: { fontSize: 22, fontWeight: '600', color: '#015197', lineHeight: 24 },
  zoomDivider: { height: 1, backgroundColor: '#E2E8F0' },
  // Route panel — sits over the filter/badge row while routing is on, which
  // is deliberate: those controls aren't what you're doing right now.
  routePanel: {
    position: 'absolute', left: 12, right: 12, backgroundColor: '#fff',
    borderRadius: 14, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 8,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
  },
  routePanelHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 6 },
  routePanelTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: '#0F172A' },
  routePanelHeadBtns: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileSwitch: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 9, padding: 2, gap: 2 },
  profileBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 7 },
  profileBtnActive: { backgroundColor: '#015197' },
  stopScroll: { maxHeight: 210 },
  stopRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 7, paddingHorizontal: 6, borderRadius: 10,
    borderWidth: 1.5, borderColor: 'transparent',
  },
  stopRowArmed: { backgroundColor: '#EFF6FF', borderColor: '#015197' },
  stopBadge: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  stopBadgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  stopLabel: { flex: 1, fontSize: 13, fontWeight: '600', color: '#1E293B' },
  stopLabelEmpty: { color: '#94A3B8', fontWeight: '500' },
  addStopBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 6 },
  addStopText: { fontSize: 13, fontWeight: '700', color: '#015197' },
  stopHint: { fontSize: 11, color: '#94A3B8', paddingVertical: 8, paddingHorizontal: 6 },
  stopPin: {
    width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: '#fff',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 4,
  },
  stopPinText: { color: '#fff', fontSize: 12, fontWeight: '800' },

  routeResult: {
    position: 'absolute', left: 12, right: 76, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  routeResultMain: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  routeResultFigures: { flex: 1 },
  routeResultText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  routeLegText: { fontSize: 11, color: '#64748B', marginTop: 2 },
  routeResetText: { fontSize: 16, color: '#94A3B8', fontWeight: '700', paddingLeft: 4 },
  altRow: { flexDirection: 'row', gap: 8, paddingTop: 8 },
  altChip: {
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14,
    backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: 'transparent',
  },
  altChipActive: { backgroundColor: '#EFF6FF', borderColor: '#015197' },
  altChipText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  altChipTextActive: { color: '#015197' },
  locateFabActive: { backgroundColor: '#015197' },
  regionsBadge: { position: 'absolute', right: 12, backgroundColor: 'rgba(100,116,139,0.85)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  sheetBackdrop: { flex: 1, backgroundColor: 'rgba(15,23,42,0.45)', justifyContent: 'flex-end' },
  sheetCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 28 },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: '#1E293B', marginBottom: 4 },
  sheetHint: { fontSize: 12, color: '#64748B', marginBottom: 10 },
  regionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  regionName: { fontSize: 14, fontWeight: '600', color: '#1E293B' },
  regionMeta: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  regionBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: '#F1F5F9' },
  sheetCloseBtn: { marginTop: 12, height: 44, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  sheetCloseText: { fontSize: 14, fontWeight: '700', color: '#334155' },
  offlineBadgeReady: { backgroundColor: 'rgba(21,128,61,0.85)' },
  offlineBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // InfoCard — wrapper spans full width to center the capped inner card (iPad:
  // absolute + left:0/right:0 would otherwise force full-bleed width regardless
  // of alignSelf on the card itself).
  infoCardWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, alignItems: 'center' },
  infoCard: { width: '100%', maxWidth: MAX_CARD_WIDTH, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
  infoCardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#ddd', alignSelf: 'center', marginBottom: 12 },
  infoCardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  infoCardIcon: { fontSize: 28 },
  infoCardTitles: { flex: 1 },
  infoCardName: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  infoCardCategory: { fontSize: 12, color: '#888', marginTop: 2 },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 16, color: '#aaa' },
  infoCardDesc: { fontSize: 13, lineHeight: 19, color: '#555', marginBottom: 10 },
  infoCardMeta: { gap: 4, marginBottom: 12 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  infoRowIcon: { fontSize: 13, width: 18 },
  infoRowText: { fontSize: 13, color: '#333' },
  infoCardActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
  actionBtnPrimary: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#333' },
  actionBtnTextPrimary: { color: '#fff' },
  // Web fallback
  webMapPlaceholder: { height: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f0f4ff', gap: 4 },
  webMapEmoji: { fontSize: 36 },
  webMapTitle: { fontSize: 15, fontWeight: '700' },
  webMapSub: { fontSize: 12, color: '#888' },
  poiList: { flex: 1 },
  poiListItem: { flexDirection: 'row', alignItems: 'flex-start', padding: 14, gap: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  poiListItemActive: { backgroundColor: '#f0f7ff' },
  poiListIcon: { fontSize: 22, width: 30 },
  poiListText: { flex: 1 },
  poiListName: { fontSize: 14, fontWeight: '600', color: '#1a1a1a' },
  poiListMeta: { fontSize: 12, color: '#888', marginTop: 2 },
});
