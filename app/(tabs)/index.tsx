import { StyleSheet, FlatList, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';

const GRID_PADDING = 12;
const CARD_MARGIN = 5;
// Fixed 3×6 grid — 16 topics (9 original + Photo/Video/Events/Calendar/
// Weather/Nature/Emotions, ported from BaikalLove's home screen) + chat/ads
// = exactly 18 tiles, so 3 columns always fills 6 even rows on every device
// instead of reflowing by width. Map is no longer a tile here — it moved to
// the bottom nav bar (see (tabs)/_layout.tsx).
const NUM_COLUMNS = 3;

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'zh' as const, flag: '🇨🇳' },
  { code: 'mn' as const, flag: '🇲🇳' },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const cardWidth = width / NUM_COLUMNS - GRID_PADDING - CARD_MARGIN * 2;
  const cardMinHeight = clamp(cardWidth * 0.85, 100, 170);
  const iconSize = clamp(cardWidth * 0.26, 28, 56);
  const titleSize = clamp(cardWidth * 0.075, 11, 16);

  const gridData = [
    ...TOPICS,
    { key: 'chat', icon: '💬', title: t('tabs.chat'), route: '/chat' },
    { key: 'ads', icon: '📋', title: t('tabs.ads'), route: '/ads' },
  ];

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.langRow}>
          {LANGUAGES.map(lang => (
            <Pressable
              key={lang.code}
              style={[styles.langBtn, current === lang.code && styles.langBtnActive]}
              onPress={() => handleLanguage(lang.code)}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.headerSub}>Travel Mongolia</Text>
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
              if ('route' in item) router.push(item.route as any);
              else if (item.key === 'transport') router.push('/transport' as any);
              else router.push(`/topic/${item.key}`);
            }}
          >
            <Text style={[styles.cardIcon, { fontSize: iconSize }]}>{item.icon}</Text>
            <Text style={[styles.cardTitle, { fontSize: titleSize }]} numberOfLines={2}>
              {'route' in item ? item.title : t(`topicTitles.${item.key}`)}
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
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  langRow: { flexDirection: 'row', justifyContent: 'center', gap: 4 },
  langBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  langBtnActive: { backgroundColor: '#e0eeff' },
  langFlag: { fontSize: 18 },
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
