import { Platform, StyleSheet, Text, View, Pressable, ScrollView, Linking, ActivityIndicator, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api, POI, RouteResult } from '@/services/api';
import { MAX_CARD_WIDTH } from '@/constants/Layout';
import { useOfflineMapPack } from '@/hooks/useOfflineMapPack';
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

// ─── Native map (iOS / Android) ───────────────────────────────────────────────
function MapNativeScreen() {
  const { t, i18n } = useTranslation();
  const CATEGORIES: MapCategory[] = POI_CATEGORIES.map(c => ({ ...c, label: t(`map.categories.${c.key}`) }));
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set(POI_CATEGORIES.map(c => c.key)));
  const [selected, setSelected] = useState<POI | null>(null);
  const [userLocationVisible, setUserLocationVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();
  const isOnline = useNetworkStatus();
  const offlinePack = useOfflineMapPack();

  // Basic point-to-point routing — an in-app preview line + distance/ETA,
  // not turn-by-turn nav (that stays the external Apple/Google/2GIS deep
  // link in InfoCard). Requires connectivity: calls TMB's /api/route, which
  // proxies to a self-hosted OSRM — unlike the map/POI browsing above, this
  // one part doesn't work offline.
  const [routingMode, setRoutingMode] = useState(false);
  const [routePoints, setRoutePoints] = useState<[number, number][]>([]); // [lng,lat]
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);

  useEffect(() => {
    api.getPOI('all').then(setPois).catch(() => {}).finally(() => setLoading(false));
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') setUserLocationVisible(true);
    })();
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
    if (poi) setSelected(poi);
  };

  useEffect(() => {
    if (routePoints.length !== 2) return;
    const [from, to] = routePoints;
    if (!from || !to) return;
    setRouteLoading(true);
    setRouteError(false);
    api.getRoute({ lat: from[1], lng: from[0] }, { lat: to[1], lng: to[0] })
      .then(setRoute)
      .catch(() => setRouteError(true))
      .finally(() => setRouteLoading(false));
  }, [routePoints]);

  const resetRoute = () => {
    setRoutePoints([]);
    setRoute(null);
    setRouteError(false);
  };
  const toggleRoutingMode = () => {
    if (routingMode) resetRoute();
    setRoutingMode(!routingMode);
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
    if (!lngLat) return;
    setRoutePoints(prev => (prev.length >= 2 ? prev : [...prev, lngLat]));
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
      <Map style={styles.map} mapStyle={mapStyle} onPress={handleMapPress}>
        <Camera
          ref={cameraRef}
          initialViewState={{ center: [103.8467, 46.8625], zoom: 5 }}
        />
        {userLocationVisible && <UserLocation />}

        {/* POIs — clustered source, colour-coded dots, tap a dot for the card */}
        <GeoJSONSource
          id="pois"
          ref={poiSourceRef}
          data={poiCollection}
          cluster
          clusterRadius={55}
          clusterMaxZoom={13}
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
              iconSize: 0.42,
              iconAllowOverlap: false,
              iconIgnorePlacement: false,
            }}
          />
        </GeoJSONSource>

        {/* Route pins */}
        {routePoints.map((pt, i) => (
          <Marker key={`route-pt-${i}`} id={`route-pt-${i}`} lngLat={pt}>
            <View style={styles.marker}>
              <Text style={styles.markerIcon}>{i === 0 ? '🟢' : '🔴'}</Text>
            </View>
          </Marker>
        ))}

        {/* Route line preview */}
        {route && (
          <GeoJSONSource id="route-source" data={route.geometry}>
            <Layer
              id="route-line"
              type="line"
              style={{ lineColor: '#015197', lineWidth: 4, lineOpacity: 0.85 }}
            />
          </GeoJSONSource>
        )}
      </Map>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* Category/layers dropdown — floats over the map, doesn't push it down */}
      <MapLayersControl
        categories={CATEGORIES}
        active={activeFilters}
        onChange={setActiveFilters}
        style={[styles.topBar, { top: insets.top + 8 }]}
      />

      {/* POI count badge */}
      {!loading && (
        <View style={[styles.countBadge, { top: insets.top + 60 }]}>
          <Text style={styles.countText}>{filtered.length} {t('map.objects')}</Text>
        </View>
      )}

      {/* Offline map pack — Mongolia has no signal outside the cities. Same
          row as the filters pill (top-left), pinned to the right edge. */}
      <OfflineMapControl pack={offlinePack} isOnline={isOnline} topOffset={insets.top + 8} />

      {/* Routing FAB + hints — needs connectivity, unlike the map/POI browsing above */}
      <Pressable
        style={[styles.routeFab, routingMode && styles.routeFabActive, { bottom: tabBarHeight + 16 }]}
        onPress={toggleRoutingMode}
      >
        <Text style={styles.routeFabIcon}>🧭</Text>
      </Pressable>

      {routingMode && routePoints.length < 2 && (
        <View style={[styles.routeHint, { bottom: tabBarHeight + 76 }]}>
          <Text style={styles.routeHintText}>
            {routePoints.length === 0 ? t('map.routeTapFrom') : t('map.routeTapTo')}
          </Text>
        </View>
      )}

      {routingMode && routePoints.length === 2 && (
        <View style={[styles.routeResult, { bottom: tabBarHeight + 76 }]}>
          {routeLoading ? (
            <ActivityIndicator size="small" color="#015197" />
          ) : routeError ? (
            <Text style={styles.routeResultText}>{t('map.routeError')}</Text>
          ) : route ? (
            <Text style={styles.routeResultText}>
              📍 {(route.distanceMeters / 1000).toFixed(1)} {t('map.routeKm')} · ⏱ {Math.round(route.durationSeconds / 60)} {t('map.routeMin')}
            </Text>
          ) : null}
          <Pressable onPress={resetRoute} hitSlop={8}>
            <Text style={styles.routeResetText}>✕</Text>
          </Pressable>
        </View>
      )}

      {/* InfoCard */}
      {selected && <InfoCard poi={selected} onClose={() => setSelected(null)} bottomOffset={tabBarHeight} />}
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

// ─── InfoCard ─────────────────────────────────────────────────────────────────
function InfoCard({ poi, onClose, bottomOffset }: { poi: POI; onClose: () => void; bottomOffset: number }) {
  const { t } = useTranslation();
  const catLabel = t(`map.categories.${poi.category}`, { defaultValue: poi.category });

  const openDirections = () => {
    const lat = poi.lat, lng = poi.lng;
    const opts = [
      { label: t('map.appleMaps'), url: `https://maps.apple.com/?daddr=${lat},${lng}` },
      { label: t('map.googleMaps'), url: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}` },
      { label: t('map.twoGis'), url: `dgis://2gis.ru/routeSearch/rsType/car/to/${lng},${lat}` },
    ];
    // Open Apple Maps by default; TODO: ActionSheet for choice
    Linking.openURL(opts[0].url);
  };

  return (
    <View style={[styles.infoCardWrapper, { bottom: bottomOffset }]} pointerEvents="box-none">
      <View style={styles.infoCard}>
        <View style={styles.infoCardHandle} />
        <View style={styles.infoCardHeader}>
          <Text style={styles.infoCardIcon}>{poi.icon || '📍'}</Text>
          <View style={styles.infoCardTitles}>
            <Text style={styles.infoCardName}>{poi.name_ru || poi.name}</Text>
            <Text style={styles.infoCardCategory}>{catLabel}</Text>
          </View>
          <Pressable onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </Pressable>
        </View>

        {poi.description && (
          <Text style={styles.infoCardDesc}>{poi.description}</Text>
        )}

        <View style={styles.infoCardMeta}>
          {poi.hours && <InfoRow icon="🕐" text={poi.hours} />}
          {poi.price && <InfoRow icon="💰" text={poi.price} />}
          {poi.phone && <InfoRow icon="📞" text={poi.phone} />}
        </View>

        <View style={styles.infoCardActions}>
          {poi.phone && (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(`tel:${poi.phone}`)}>
              <Text style={styles.actionBtnText}>📞 {t('map.call')}</Text>
            </Pressable>
          )}
          <Pressable style={[styles.actionBtn, styles.actionBtnPrimary]} onPress={openDirections}>
            <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>📍 {t('map.route')}</Text>
          </Pressable>
          {poi.url && (
            <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(poi.url!)}>
              <Text style={styles.actionBtnText}>🌐 {t('map.website')}</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
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
  marker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  markerIcon: { fontSize: 24 },
  loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  countBadge: { position: 'absolute', top: 60, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  offlineBadge: { position: 'absolute', right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  routeFab: {
    position: 'absolute', right: 12, width: 52, height: 52, borderRadius: 26,
    backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 6,
  },
  routeFabActive: { backgroundColor: '#015197' },
  routeFabIcon: { fontSize: 24 },
  routeHint: {
    position: 'absolute', left: 12, right: 76, backgroundColor: 'rgba(1,81,151,0.92)',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
  },
  routeHintText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  routeResult: {
    position: 'absolute', left: 12, right: 76, backgroundColor: '#fff',
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 5,
  },
  routeResultText: { fontSize: 13, fontWeight: '700', color: '#1a1a1a' },
  routeResetText: { fontSize: 16, color: '#94A3B8', fontWeight: '700', paddingLeft: 10 },
  offlineBadgeReady: { backgroundColor: 'rgba(21,128,61,0.85)' },
  offlineBadgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
