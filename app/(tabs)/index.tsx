import { StyleSheet, FlatList, Pressable, Text, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';

const GRID_PADDING = 12;
const CARD_MARGIN = 5;
// 17 tiles total (9 original topics + Photo/Video/Events/Calendar/Weather/
// Nature/Emotions ported from BaikalLove's home screen + Ads). Map is no
// longer a tile here — it moved to the bottom nav bar (see
// (tabs)/_layout.tsx). Language picking moved to Account — this screen no
// longer has its own row for it. Chat isn't a tile either — it's reached as
// "Спросить" from inside the Язык topic (app/topic/[key].tsx).
//
// 3 columns everywhere, phone and iPad alike (17 tiles -> 6 rows). What
// changes on a wider screen isn't the column count, it's how row height is
// computed below — fit to the actual screen height instead of derived from
// column width, which is what let a 3-column iPad grid fit without
// scrolling in the first place.
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
  const { width, height } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const numColumns = NUM_COLUMNS;
  const isWide = width >= 600;
  const cardWidth = width / numColumns - GRID_PADDING - CARD_MARGIN * 2;

  // Phones keep the original width-derived sizing (already tuned). On wider
  // screens, size rows to the actual available height instead — that's what
  // "fits without scrolling" means, not just a wider column.
  let cardMinHeight: number;
  if (isWide) {
    const rows = Math.ceil(gridData.length / numColumns);
    const availableHeight = height - tabBarHeight - GRID_PADDING * 2 - (rows - 1) * 10;
    cardMinHeight = clamp(availableHeight / rows - CARD_MARGIN * 2, 80, 170);
  } else {
    cardMinHeight = clamp(cardWidth * 0.85, 100, 170);
  }
  const iconSize = clamp(cardWidth * 0.26, 24, 56);
  const titleSize = clamp(cardWidth * 0.075, 10, 16);

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        // numColumns can't change on a mounted FlatList — keying by it forces
        // a remount when a rotation/resize crosses a breakpoint.
        key={numColumns}
        data={gridData}
        keyExtractor={(item) => item.key}
        numColumns={numColumns}
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
