import { StyleSheet, ScrollView, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';
import { readingContainerStyle } from '@/constants/Layout';

// A quick-link button shown above the regular subquestions, for a topic
// that needs one entry point that isn't just "ask this canned question in
// chat" (transport's own schedules screen) or is the chat itself, opened
// with no preset question — Chat no longer has its own home-grid tile, this
// is how the Язык topic reaches it now, relabeled "Переводчик".
const SPECIAL_LINKS: Record<string, { route: string; label: string }> = {
  transport: { route: '/transport', label: '📅 Расписания транспорта' },
  language: { route: '/chat', label: '💬 Переводчик' },
};

export default function TopicScreen() {
  const { t } = useTranslation();
  const { key } = useLocalSearchParams<{ key: string }>();
  const topic = TOPICS.find((tp) => tp.key === key);

  if (!topic) return (
    <View style={styles.center}>
      <Text>Тема не найдена</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `${topic.icon} ${t(`topicTitles.${topic.key}`)}` }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.overview}>
          <Text style={styles.overviewText}>{topic.overview}</Text>
        </View>
        <Text style={styles.subheading}>Вопросы</Text>
        {SPECIAL_LINKS[key] && (
          <Pressable
            style={({ pressed }) => [styles.sqBtn, styles.sqBtnSpecial, pressed && styles.sqBtnPressed]}
            onPress={() => router.push(SPECIAL_LINKS[key].route as any)}
          >
            <Text style={styles.sqLabel}>{SPECIAL_LINKS[key].label}</Text>
            <Text style={styles.sqArrow}>›</Text>
          </Pressable>
        )}
        {topic.subquestions.map((sq, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [styles.sqBtn, pressed && styles.sqBtnPressed]}
            onPress={() => {
              if (sq.specialSlide === 'phrases') {
                router.push('/phrases');
              } else if (sq.q) {
                router.push({ pathname: '/chat', params: { question: sq.q, label: sq.label } });
              }
            }}
          >
            <Text style={styles.sqLabel}>{sq.label}</Text>
            <Text style={styles.sqArrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 10, ...readingContainerStyle },
  overview: { backgroundColor: '#f5f9ff', borderRadius: 12, padding: 14, marginBottom: 8 },
  overviewText: { fontSize: 14, lineHeight: 22, color: '#333' },
  subheading: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  sqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
  },
  sqBtnPressed: { backgroundColor: '#f0f7ff' },
  sqBtnSpecial: { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' },
  sqLabel: { fontSize: 15, flex: 1 },
  sqArrow: { fontSize: 20, color: '#aaa' },
});
