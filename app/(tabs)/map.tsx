import { Platform, StyleSheet, Text, View, Pressable, ScrollView, Linking, ActivityIndicator } from 'react-native';
import { useEffect, useState, useRef } from 'react';
import { api, POI } from '@/services/api';

export default function MapScreen() {
  if (Platform.OS === 'web') return <MapWebFallback />;
  return <MapNativeScreen />;
}

// ─── Category filter config ───────────────────────────────────────────────────
const CATEGORIES = [
  { key: 'all',           label: 'Все',      icon: '📍' },
  { key: 'sight',         label: 'Места',    icon: '🏛️' },
  { key: 'food',          label: 'Еда',      icon: '🍽️' },
  { key: 'accommodation', label: 'Жильё',    icon: '🏨' },
  { key: 'camp',          label: 'Лагеря',   icon: '🏕️' },
  { key: 'transport',     label: 'Транспорт',icon: '✈️' },
  { key: 'safety',        label: 'Помощь',   icon: '🏥' },
];

// ─── Native map (iOS / Android) ───────────────────────────────────────────────
function MapNativeScreen() {
  const MapLibreGL = require('@maplibre/maplibre-react-native');
  const Location = require('expo-location');
  MapLibreGL.setAccessToken(null);

  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<POI | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    api.getPOI('all').then(setPois).catch(() => {}).finally(() => setLoading(false));
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation({ lat: loc.coords.latitude, lng: loc.coords.longitude });
      }
    })();
  }, []);

  const filtered = activeCategory === 'all'
    ? pois
    : pois.filter(p => p.category === activeCategory);

  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  const mapStyle = JSON.stringify({
    version: 8,
    sources: { osm: { type: 'raster', tiles: [TILE_URL], tileSize: 256, attribution: '© OpenStreetMap' } },
    layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
  });

  return (
    <View style={styles.container}>
      {/* Category filter */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            style={[styles.filterChip, activeCategory === cat.key && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.filterIcon}>{cat.icon}</Text>
            <Text style={[styles.filterLabel, activeCategory === cat.key && styles.filterLabelActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Map */}
      <MapLibreGL.MapView style={styles.map} styleJSON={mapStyle} onPress={() => setSelected(null)}>
        <MapLibreGL.Camera
          defaultSettings={{ centerCoordinate: [103.8467, 46.8625], zoomLevel: 5 }}
        />
        {userLocation && <MapLibreGL.UserLocation visible />}
        {filtered.map(poi => (
          <MapLibreGL.PointAnnotation
            key={`poi-${poi.id}`}
            id={`poi-${poi.id}`}
            coordinate={[poi.lng, poi.lat]}
            onSelected={() => setSelected(poi)}
          >
            <View style={styles.marker}>
              <Text style={styles.markerIcon}>{poi.icon || '📍'}</Text>
            </View>
          </MapLibreGL.PointAnnotation>
        ))}
      </MapLibreGL.MapView>

      {/* Loading overlay */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      )}

      {/* POI count badge */}
      {!loading && (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{filtered.length} объектов</Text>
        </View>
      )}

      {/* InfoCard */}
      {selected && <InfoCard poi={selected} onClose={() => setSelected(null)} />}
    </View>
  );
}

// ─── InfoCard ─────────────────────────────────────────────────────────────────
function InfoCard({ poi, onClose }: { poi: POI; onClose: () => void }) {
  const catLabel = CATEGORIES.find(c => c.key === poi.category)?.label || poi.category;

  return (
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
            <Text style={styles.actionBtnText}>📞 Позвонить</Text>
          </Pressable>
        )}
        <Pressable
          style={[styles.actionBtn, styles.actionBtnPrimary]}
          onPress={() => {
            const url = `https://maps.apple.com/?daddr=${poi.lat},${poi.lng}`;
            Linking.openURL(url);
          }}
        >
          <Text style={[styles.actionBtnText, styles.actionBtnTextPrimary]}>📍 Маршрут</Text>
        </Pressable>
        {poi.url && (
          <Pressable style={styles.actionBtn} onPress={() => Linking.openURL(poi.url!)}>
            <Text style={styles.actionBtnText}>🌐 Сайт</Text>
          </Pressable>
        )}
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
  const [pois, setPois] = useState<POI[]>([]);
  const [activeCategory, setActiveCategory] = useState('all');
  const [selected, setSelected] = useState<POI | null>(null);

  useEffect(() => { api.getPOI('all').then(setPois).catch(() => {}); }, []);

  const filtered = activeCategory === 'all' ? pois : pois.filter(p => p.category === activeCategory);

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterBar} contentContainerStyle={styles.filterContent}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            style={[styles.filterChip, activeCategory === cat.key && styles.filterChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.filterIcon}>{cat.icon}</Text>
            <Text style={[styles.filterLabel, activeCategory === cat.key && styles.filterLabelActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.webMapPlaceholder}>
        <Text style={styles.webMapEmoji}>🗺️</Text>
        <Text style={styles.webMapTitle}>Интерактивная карта</Text>
        <Text style={styles.webMapSub}>Доступна в мобильном приложении iOS/Android</Text>
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
  filterBar: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  filterContent: { paddingHorizontal: 10, alignItems: 'center', gap: 6, paddingVertical: 8 },
  filterChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
  filterChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  filterIcon: { fontSize: 13 },
  filterLabel: { fontSize: 12, fontWeight: '500', color: '#555' },
  filterLabelActive: { color: '#fff' },
  marker: { alignItems: 'center', justifyContent: 'center' },
  markerIcon: { fontSize: 24 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.5)' },
  countBadge: { position: 'absolute', top: 60, right: 12, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4 },
  countText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  // InfoCard
  infoCard: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 16, paddingBottom: 32, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 10 },
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
