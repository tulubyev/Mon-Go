import { StyleSheet, ScrollView, Text, View, SafeAreaView, Pressable } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { WIKI_ARTICLES, wikiCategoryLabel, type WikiLocale } from '@/constants/wiki';

/**
 * Renders a very small subset of Markdown used by the article bodies:
 * `**bold**` paragraph headings and `*italic*` sub-labels. Anything else
 * is plain text, so a body written without markers still reads correctly.
 */
function renderBody(body: string) {
  return body.split('\n\n').map((block, i) => {
    const trimmed = block.trim();
    if (!trimmed) return null;

    if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
      return <Text key={i} style={styles.heading}>{trimmed.slice(2, -2)}</Text>;
    }
    if (trimmed.startsWith('*') && trimmed.endsWith('*') && !trimmed.startsWith('**')) {
      return <Text key={i} style={styles.subheading}>{trimmed.slice(1, -1)}</Text>;
    }
    // Inline *italic* lead-ins like "*Площадь Сухэ-Батора (09:00).* Центр города."
    const inline = trimmed.match(/^\*(.+?)\*\s*(.*)$/s);
    if (inline) {
      return (
        <Text key={i} style={styles.paragraph}>
          <Text style={styles.inlineEmphasis}>{inline[1]}</Text>
          {inline[2] ? ` ${inline[2]}` : ''}
        </Text>
      );
    }
    return <Text key={i} style={styles.paragraph}>{trimmed}</Text>;
  });
}

export default function WikiArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as WikiLocale) || 'ru';

  const article = WIKI_ARTICLES.find(a => a.id === id);

  if (!article) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>{t('wiki.notFound')}</Text>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <Text style={styles.backBtnText}>{t('common.back')}</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  // Bodies are authored in Russian first; other locales fall back until translated.
  const body = article.body[lang] ?? article.body.ru ?? article.summary[lang];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.closeBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color="#1E293B" />
        </Pressable>
        <View style={[styles.catBadge, { backgroundColor: article.categoryColor }]}>
          <Ionicons name={article.icon as any} size={12} color="#fff" />
          <Text style={styles.catText}>{wikiCategoryLabel(article.category, lang)}</Text>
        </View>
        <Text style={styles.readTime}>{article.readMin} {t('wiki.min')}</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{article.title[lang]}</Text>
        <Text style={styles.summary}>{article.summary[lang]}</Text>
        <View style={[styles.divider, { backgroundColor: article.categoryColor + '30' }]} />
        {renderBody(body)}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0',
  },
  closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  catBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  catText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  readTime: { marginLeft: 'auto', fontSize: 12, color: '#94A3B8' },

  body: { padding: 20 },
  title: { fontSize: 26, fontWeight: '800', color: '#0F172A', lineHeight: 34, marginBottom: 12 },
  summary: { fontSize: 15, color: '#64748B', lineHeight: 23, marginBottom: 16 },
  divider: { height: 2, borderRadius: 1, marginBottom: 20 },

  heading: { fontSize: 18, fontWeight: '700', color: '#0F172A', marginTop: 20, marginBottom: 8 },
  subheading: { fontSize: 15, fontWeight: '700', color: '#334155', marginTop: 14, marginBottom: 6 },
  paragraph: { fontSize: 15, lineHeight: 25, color: '#334155', marginBottom: 12 },
  inlineEmphasis: { fontWeight: '700', color: '#0F172A' },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 },
  notFoundText: { fontSize: 16, color: '#64748B' },
  backBtn: { backgroundColor: '#015197', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
  backBtnText: { color: '#fff', fontWeight: '700' },
});
