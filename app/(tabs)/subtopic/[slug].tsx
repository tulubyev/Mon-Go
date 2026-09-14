import { StyleSheet, ScrollView, Pressable, Text, View, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';
import MarkdownLiteText from '@/components/MarkdownLiteText';
import { readingContainerStyle } from '@/constants/Layout';
import { useSubtopicContent } from '@/hooks/useContent';

export default function SubtopicScreen() {
  const { t, i18n } = useTranslation();
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const lang = i18n.language || 'ru';
  const tabBarHeight = useBottomTabBarHeight();

  const { data, isLoading } = useSubtopicContent(slug, lang);
  const items = data?.items ?? [];

  const askAi = () => {
    const question = data?.title
      ? `${data.title} — подробно, с ценами, адресами и телефонами на 2026 год`
      : 'Расскажи подробнее об этой теме';
    router.push({
      pathname: '/chat',
      params: { question, label: data?.title || t('chat.title'), subtopic: slug },
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: data?.title || '…', headerBackTitle: t('common.back') }} />
      <ScrollView contentContainerStyle={[styles.scroll, readingContainerStyle, { paddingBottom: tabBarHeight + 24 }]}>
        {isLoading ? (
          <ActivityIndicator color="#015197" style={{ marginTop: 40 }} />
        ) : items.length > 0 ? (
          <>
            {items.map(item => (
              <View key={item.id} style={styles.card}>
                {item.lang_effective !== lang && (
                  <Text style={styles.langNotice}>🌐 Перевод недоступен — показан русский текст</Text>
                )}
                <MarkdownLiteText text={item.answer} style={styles.answerText} selectable />
              </View>
            ))}
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyTitle}>Готового ответа пока нет</Text>
            <Text style={styles.emptySub}>Можем спросить ИИ прямо сейчас</Text>
          </View>
        )}

        <Pressable style={styles.aiBtn} onPress={askAi}>
          <Text style={styles.aiBtnText}>🤖 {items.length > 0 ? 'Не нашли ответ? Спросить ИИ' : 'Спросить ИИ'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  scroll: { padding: 16, gap: 12 },
  card: { backgroundColor: '#f5f9ff', borderRadius: 12, padding: 14, gap: 8 },
  answerText: { fontSize: 15, lineHeight: 23, color: '#1a1a1a' },
  langNotice: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },

  empty: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 40 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#1a1a1a' },
  emptySub: { fontSize: 13, color: '#888' },

  aiBtn: {
    marginTop: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#eff6ff', borderRadius: 12, paddingVertical: 14,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  aiBtnText: { fontSize: 14, fontWeight: '700', color: '#015197' },
});
