import { StyleSheet, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';

const GRID_PADDING = 12;
const CARD_MARGIN = 5;
// Fixed-width 3-column grid — 16 topics (9 original + Photo/Video/Events/
// Calendar/Weather/Nature/Emotions, ported from BaikalLove's home screen) +
// Ads = 17 tiles, so the last row runs 2 wide instead of reflowing by
// device width. Map is no longer a tile here — it moved to the bottom nav
// bar (see (tabs)/_layout.tsx). Language picking moved to Account — this
// screen no longer has its own row for it. Chat isn't a tile either — it's
// reached as "Спросить" from inside the Язык topic (app/topic/[key].tsx).
const NUM_COLUMNS = 3;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Ads isn't in constants/topics.ts — it's an app section, not a wiki-style
// topic — so it's added here before laying the grid out. Chat no longer
// gets its own tile: it moved inside the Язык topic screen as a "Спросить"
// quick-link (see app/topic/[key].tsx's SPECIAL_LINKS).
const EXTRA_TILES = [
  { key: 'ads', icon: '📋', route: '/ads' },
];
const ALL_TILES = [...TOPICS, ...EXTRA_TILES];

// Explicit placement (not just TOPICS order + append) so Безопасность
// ("SOS") sits with Услуги on the last row. 17 tiles now that Chat moved
// out — the last row runs 2 wide instead of 3, which is fine.
const GRID_ORDER = [
  'transport', 'accommodation', 'finance',
  'communication', 'language', 'planning',
  'ulaanbaatar', 'food', 'weather',
  'nature', 'emotions', 'events',
  'calendar', 'photos', 'videos',
  'safety', 'ads',
];
const gridData = GRID_ORDER
  .map(key => ALL_TILES.find(item => item.key === key))
  .filter((item): item is typeof ALL_TILES[number] => !!item);

export default function HomeScreen() {
  const { t } = useTranslation();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const cardWidth = width / NUM_COLUMNS - GRID_PADDING - CARD_MARGIN * 2;
  const cardMinHeight = clamp(cardWidth * 0.85, 100, 170);
  const iconSize = clamp(cardWidth * 0.26, 28, 56);
  const titleSize = clamp(cardWidth * 0.075, 11, 16);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>{t('home.title')}</Text>
        <Text style={styles.headerSub}>{t('home.subtitle')}</Text>
      </View>
      <FlatList
        data={gridData}
        keyExtractor={(item) => item.key}
        numColumns={NUM_COLUMNS}
        contentContainerStyle={[styles.grid, { paddingBottom: tabBarHeight + 12 }]}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, { minHeight: cardMinHeight }, pressed && styles.cardPressed]}
            onPress={() => {
              // Photos/Videos/Events/Calendar got real dedicated screens
              // (ported from BaikalLove) instead of the generic /topic
              // template the other topic tiles still use.
              const DEDICATED_ROUTES: Record<string, string> = {
                photos: '/photos', videos: '/videos', events: '/events', calendar: '/calendar',
              };
              if ('route' in item) router.push(item.route as any);
              else if (item.key === 'transport') router.push('/transport' as any);
              else if (DEDICATED_ROUTES[item.key]) router.push(DEDICATED_ROUTES[item.key] as any);
              else router.push(`/topic/${item.key}`);
            }}
          >
            <Text style={[styles.cardIcon, { fontSize: iconSize }]}>{item.icon}</Text>
            <Text style={[styles.cardTitle, { fontSize: titleSize }]} numberOfLines={2}>
              {'route' in item ? t(`tabs.${item.key}`) : t(`topicTitles.${item.key}`)}
            </Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', paddingVertical: 16, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  grid: { padding: 12, gap: 10 },
  card: {
    flex: 1,
    margin: 5,
    padding: 14,
    backgroundColor: '#f5f9ff',
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
    minHeight: 100,
    justifyContent: 'center',
  },
  cardPressed: { backgroundColor: '#e0eeff', transform: [{ scale: 0.97 }] },
  cardIcon: { fontSize: 30 },
  cardTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center', color: '#333' },
});
