import { StyleSheet, ScrollView, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { TOPICS } from '@/constants/topics';
import { readingContainerStyle } from '@/constants/Layout';
import MarkdownLiteText from '@/components/MarkdownLiteText';
import { useContentManifest } from '@/hooks/useContent';
import type { ContentSubtopic } from '@/services/api';

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
  const { t, i18n } = useTranslation();
  const { key } = useLocalSearchParams<{ key: string }>();
  const topic = TOPICS.find((tp) => tp.key === key);
  const lang = i18n.language || 'ru';

  // Prepared subtopics for this topic, if the manifest has loaded (it's
  // persisted via react-query's AsyncStorage cache, so after the first
  // successful fetch this is instant even offline). Falls back to the old
  // "ask this preset question" list below when empty — cold first launch,
  // no connectivity yet, or a topic that hasn't been broken into subtopics.
  const { data: manifest } = useContentManifest(lang);
  const subtopics: ContentSubtopic[] = manifest?.topics.find(tp => tp.topic_key === key)?.subtopics ?? [];

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
          <MarkdownLiteText text={topic.overview} style={styles.overviewText} selectable />
        </View>

        {SPECIAL_LINKS[key] && (
          <Pressable
            style={({ pressed }) => [styles.sqBtn, styles.sqBtnSpecial, pressed && styles.sqBtnPressed]}
            onPress={() => router.push(SPECIAL_LINKS[key].route as any)}
          >
            <Text style={styles.sqLabel}>{SPECIAL_LINKS[key].label}</Text>
            <Text style={styles.sqArrow}>›</Text>
          </Pressable>
        )}

        {subtopics.length > 0 ? (
          <>
            <Text style={styles.subheading}>Подробнее</Text>
            <View style={styles.grid}>
              {subtopics.map(sub => (
                <Pressable
                  key={sub.slug}
                  style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
                  onPress={() => router.push(`/subtopic/${sub.slug}` as any)}
                >
                  <Text style={styles.cardIcon}>{sub.icon || '📄'}</Text>
                  <Text style={styles.cardTitle} numberOfLines={2}>{sub.title}</Text>
                  {!!sub.blurb && <Text style={styles.cardBlurb} numberOfLines={2}>{sub.blurb}</Text>}
                  {sub.item_count === 0 && <Text style={styles.cardAiHint}>🤖 спросить ИИ</Text>}
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <>
            <Text style={styles.subheading}>Вопросы</Text>
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
          </>
        )}
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

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47%',
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    gap: 4,
  },
  cardPressed: { backgroundColor: '#f0f7ff' },
  cardIcon: { fontSize: 24 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1a1a1a' },
  cardBlurb: { fontSize: 12, color: '#888', lineHeight: 16 },
  cardAiHint: { fontSize: 11, color: '#3b82f6', marginTop: 2 },

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
