import { Platform, StyleSheet, Text, View } from 'react-native';

// MapLibre is a native module — not available on web
if (Platform.OS !== 'web') {
  const MapLibreGL = require('@maplibre/maplibre-react-native');
  MapLibreGL.setAccessToken(null); // not needed for OSM/PMTiles
}

export default Platform.OS === 'web' ? MapWebFallback : MapNativeScreen;

function MapWebFallback() {
  return (
    <View style={styles.center}>
      <Text style={styles.emoji}>🗺️</Text>
      <Text style={styles.title}>Карта Монголии</Text>
      <Text style={styles.sub}>Доступна в мобильном приложении</Text>
      <Text style={styles.hint}>iOS / Android — MapLibre + офлайн тайлы</Text>
    </View>
  );
}

function MapNativeScreen() {
  const MapLibreGL = require('@maplibre/maplibre-react-native');
  const { useEffect, useState } = require('react');
  const Location = require('expo-location');

  const MONGOLIA_CENTER = { longitude: 103.8467, latitude: 46.8625 };
  const TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({});
        setUserLocation(loc.coords);
      }
    })();
  }, []);

  return (
    <MapLibreGL.MapView
      style={styles.map}
      styleJSON={JSON.stringify({
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: [TILE_URL],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [{
          id: 'osm-tiles',
          type: 'raster',
          source: 'osm',
        }],
      })}
    >
      <MapLibreGL.Camera
        defaultSettings={{
          centerCoordinate: [MONGOLIA_CENTER.longitude, MONGOLIA_CENTER.latitude],
          zoomLevel: 5,
        }}
      />
      {userLocation && (
        <MapLibreGL.UserLocation visible />
      )}
    </MapLibreGL.MapView>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emoji: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#555', textAlign: 'center' },
  hint: { fontSize: 12, color: '#aaa', textAlign: 'center' },
});
