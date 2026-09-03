import { StyleSheet, FlatList, Pressable, Text, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'zh' as const, flag: '🇨🇳' },
  { code: 'mn' as const, flag: '🇲🇳' },
];

export default function HomeScreen() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());

  const gridData = [
    ...TOPICS,
    { key: 'map', icon: '🗺️', title: t('tabs.map'), route: '/map' },
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
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => {
              if ('route' in item) router.push(item.route as any);
              else if (item.key === 'transport') router.push('/transport' as any);
              else router.push(`/topic/${item.key}`);
            }}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
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
