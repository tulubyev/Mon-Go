import { useMemo, useRef, useState } from 'react';
import {
  StyleSheet, ScrollView, Pressable, Text, View, SafeAreaView,
  Modal, TextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  WIKI_ARTICLES, WIKI_CATEGORIES, wikiCategoryLabel,
  type WikiArticle, type WikiLocale,
} from '@/constants/wiki';
import { api, type WikiDbArticle } from '@/services/api';

const ICON_OPTIONS = [
  'document-text', 'sunny', 'business', 'shield', 'trophy', 'restaurant',
  'train', 'leaf', 'home', 'flower', 'paw', 'ribbon', 'car', 'snow',
  'cash', 'flame', 'map', 'camera', 'star', 'people', 'compass', 'water',
];

const COLOR_OPTIONS = [
  '#10B981', '#A855F7', '#F97316', '#EF4444', '#0EA5E9',
  '#8B5CF6', '#06B6D4', '#EC4899', '#015197', '#64748B',
];

/** DB rows carry flat *_ru/_en/_zh/_mn columns; normalise them into the static shape. */
function dbRowToArticle(row: WikiDbArticle): WikiArticle {
  return {
    id: `dyn_${row.id}`,
    category: row.category,
    categoryColor: row.category_color || '#015197',
    icon: row.icon || 'document-text',
    readMin: row.read_min || 3,
    dynamic: true,
    title: {
      ru: row.title_ru || '',
      en: row.title_en || row.title_ru || '',
      zh: row.title_zh || row.title_ru || '',
      mn: row.title_mn || row.title_ru || '',
    },
    summary: {
      ru: row.summary_ru || '',
      en: row.summary_en || row.summary_ru || '',
      zh: row.summary_zh || row.summary_ru || '',
      mn: row.summary_mn || row.summary_ru || '',
    },
    body: {},
  };
}

export default function WikiScreen() {
  const { t, i18n } = useTranslation();
  const lang = (i18n.language as WikiLocale) || 'ru';
  const qc = useQueryClient();

  const [activeCategory, setActiveCategory] = useState('all');
  const [selectedDynamic, setSelectedDynamic] = useState<WikiArticle | null>(null);
  const [showSubmit, setShowSubmit] = useState(false);
  const chipScroll = useRef<ScrollView>(null);

  const { data: dbArticles } = useQuery({
    queryKey: ['wiki-articles'],
    queryFn: () => api.getWikiArticles(),
    staleTime: 60_000,
  });

  const allArticles = useMemo(() => {
    const dyn = (dbArticles ?? []).map(dbRowToArticle);
    return [...dyn, ...WIKI_ARTICLES];
  }, [dbArticles]);

  // Community articles may introduce categories the static list doesn't know about.
  const filters = useMemo(() => {
    const known = new Set<string>(WIKI_CATEGORIES.map(c => c.key));
    const extra = [];
    for (const a of allArticles) {
      if (!known.has(a.category)) {
        known.add(a.category);
        extra.push({ key: a.category, color: a.categoryColor, label: null });
      }
    }
    return [
      ...WIKI_CATEGORIES.map(c => ({ key: c.key, color: c.color, label: c.label })),
      ...extra,
    ];
  }, [allArticles]);

  const filtered = activeCategory === 'all'
    ? allArticles
    : allArticles.filter(a => a.category === activeCategory);

  const activeColor = filters.find(f => f.key === activeCategory)?.color ?? '#015197';

  const stepCategory = (dir: -1 | 1) => {
    const cur = filters.findIndex(f => f.key === activeCategory);
    const next = (cur + dir + filters.length) % filters.length;
    setActiveCategory(filters[next].key);
    chipScroll.current?.scrollTo({ x: Math.max(0, next * 108 - 108), animated: true });
  };

  const openArticle = (article: WikiArticle) => {
    if (article.dynamic) setSelectedDynamic(article);
    else router.push(`/wiki/${article.id}` as any);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('wiki.title')}</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{allArticles.length}</Text>
        </View>
      </View>

      <View style={[styles.sliderWrap, { borderColor: activeColor }]}>
        <Pressable style={styles.arrowBtn} onPress={() => stepCategory(-1)} hitSlop={8}>
          <Text style={[styles.arrow, { color: activeColor }]}>‹</Text>
        </Pressable>
        <ScrollView
          ref={chipScroll}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          style={styles.chipScroll}
        >
          {filters.map(f => {
            const active = f.key === activeCategory;
            const label = f.label
              ? wikiCategoryLabel(f.key, lang)
              : f.key;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active ? { backgroundColor: f.color } : styles.chipOff]}
                onPress={() => setActiveCategory(f.key)}
              >
                <Text style={[styles.chipLabel, !active && styles.chipLabelOff]}>{label}</Text>
              </Pressable>
            );
          })}
          <Pressable style={styles.addChip} onPress={() => setShowSubmit(true)}>
            <Ionicons name="add" size={18} color="#015197" />
          </Pressable>
        </ScrollView>
        <Pressable style={styles.arrowBtn} onPress={() => stepCategory(1)} hitSlop={8}>
          <Text style={[styles.arrow, { color: activeColor }]}>›</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {filtered.map(article => (
          <Pressable
            key={article.id}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => openArticle(article)}
          >
            <View style={styles.cardTop}>
              <View style={[styles.iconBox, { backgroundColor: article.categoryColor + '18' }]}>
                <Ionicons name={article.icon as any} size={22} color={article.categoryColor} />
              </View>
              <View style={styles.cardMeta}>
                <View style={[styles.pill, { backgroundColor: article.categoryColor + '18' }]}>
                  <Text style={[styles.pillText, { color: article.categoryColor }]}>
                    {wikiCategoryLabel(article.category, lang)}
                  </Text>
                </View>
                {article.dynamic ? (
                  <View style={styles.communityTag}>
                    <Ionicons name="person-circle-outline" size={12} color="#64748B" />
                    <Text style={styles.communityTagText}>{t('wiki.community')}</Text>
                  </View>
                ) : (
                  <Text style={styles.readTime}>{article.readMin} {t('wiki.min')}</Text>
                )}
              </View>
            </View>
            <Text style={styles.cardTitle}>{article.title[lang]}</Text>
            <Text style={styles.cardSummary}>{article.summary[lang]}</Text>
            <Text style={[styles.readMore, { color: article.categoryColor }]}>
              {t('wiki.readMore')} →
            </Text>
          </Pressable>
        ))}
        <View style={{ height: 24 }} />
      </ScrollView>

      <DynamicReader
        article={selectedDynamic}
        lang={lang}
        onClose={() => setSelectedDynamic(null)}
      />
      <SubmitModal
        visible={showSubmit}
        lang={lang}
        knownCategories={allArticles}
        onClose={() => setShowSubmit(false)}
        onSubmitted={() => qc.invalidateQueries({ queryKey: ['wiki-articles'] })}
      />
    </SafeAreaView>
  );
}

function DynamicReader({ article, lang, onClose }: {
  article: WikiArticle | null; lang: WikiLocale; onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Modal visible={!!article} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      {article && (
        <SafeAreaView style={styles.readerContainer}>
          <View style={styles.readerHeader}>
            <Pressable onPress={onClose} style={styles.readerClose} hitSlop={8}>
              <Ionicons name="close" size={20} color="#1E293B" />
            </Pressable>
            <View style={[styles.readerCat, { backgroundColor: article.categoryColor }]}>
              <Ionicons name={article.icon as any} size={12} color="#fff" />
              <Text style={styles.readerCatText}>
                {wikiCategoryLabel(article.category, lang)}
              </Text>
            </View>
            <View style={styles.communityTag}>
              <Ionicons name="people-outline" size={13} color="#64748B" />
              <Text style={styles.communityTagText}>{t('wiki.community')}</Text>
            </View>
          </View>
          <ScrollView contentContainerStyle={styles.readerBody} showsVerticalScrollIndicator={false}>
            <Text style={styles.readerTitle}>{article.title[lang]}</Text>
            <Text style={styles.readerText}>{article.summary[lang]}</Text>
          </ScrollView>
        </SafeAreaView>
      )}
    </Modal>
  );
}

function SubmitModal({ visible, lang, knownCategories, onClose, onSubmitted }: {
  visible: boolean;
  lang: WikiLocale;
  knownCategories: WikiArticle[];
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const { t } = useTranslation();
  const [form, setForm] = useState({
    category: '', categoryColor: '#10B981', icon: 'document-text',
    titleRu: '', titleEn: '', titleZh: '', titleMn: '',
    summaryRu: '', summaryEn: '', summaryZh: '', summaryMn: '',
    contact: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [translating, setTranslating] = useState<'title' | 'summary' | null>(null);
  const titleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const set = (patch: Partial<typeof form>) => setForm(f => ({ ...f, ...patch }));

  // Debounced auto-translation: the author types Russian, the other three fill in.
  const autoTranslate = async (text: string, field: 'title' | 'summary') => {
    if (!text.trim()) return;
    setTranslating(field);
    try {
      const [en, zh, mn] = await Promise.all([
        api.translate(text, 'ru', 'en'),
        api.translate(text, 'ru', 'zh'),
        api.translate(text, 'ru', 'mn'),
      ]);
      if (field === 'title') {
        set({
          titleEn: en.translation || '',
          titleZh: zh.translation || '',
          titleMn: mn.translation || '',
        });
      } else {
        set({
          summaryEn: en.translation || '',
          summaryZh: zh.translation || '',
          summaryMn: mn.translation || '',
        });
      }
    } catch { /* leave the other locales empty; moderation can fill them */ }
    finally { setTranslating(null); }
  };

  const onTitleRu = (text: string) => {
    set({ titleRu: text });
    if (titleTimer.current) clearTimeout(titleTimer.current);
    titleTimer.current = setTimeout(() => autoTranslate(text, 'title'), 1200);
  };

  const onSummaryRu = (text: string) => {
    set({ summaryRu: text });
    if (summaryTimer.current) clearTimeout(summaryTimer.current);
    summaryTimer.current = setTimeout(() => autoTranslate(text, 'summary'), 1200);
  };

  const submit = async () => {
    if (!form.category.trim() || form.titleRu.trim().length < 3 || form.summaryRu.trim().length < 10) {
      Alert.alert('', t('wiki.requiredFields'));
      return;
    }
    setSubmitting(true);
    try {
      await api.submitWikiArticle({
        category: form.category.trim(),
        categoryColor: form.categoryColor,
        icon: form.icon,
        titleRu: form.titleRu.trim(),
        titleEn: form.titleEn.trim() || undefined,
        titleZh: form.titleZh.trim() || undefined,
        titleMn: form.titleMn.trim() || undefined,
        summaryRu: form.summaryRu.trim(),
        summaryEn: form.summaryEn.trim() || undefined,
        summaryZh: form.summaryZh.trim() || undefined,
        summaryMn: form.summaryMn.trim() || undefined,
        contact: form.contact.trim() || undefined,
      });
      onClose();
      onSubmitted();
      Alert.alert(t('wiki.submitted'), t('wiki.submittedMsg'));
      setForm({
        category: '', categoryColor: '#10B981', icon: 'document-text',
        titleRu: '', titleEn: '', titleZh: '', titleMn: '',
        summaryRu: '', summaryEn: '', summaryZh: '', summaryMn: '',
        contact: '',
      });
    } catch {
      Alert.alert(t('common.error'), t('wiki.submitError'));
    } finally {
      setSubmitting(false);
    }
  };

  const existingCategories = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of knownCategories) if (!seen.has(a.category)) seen.set(a.category, a.categoryColor);
    return [...seen.entries()].map(([key, color]) => ({ key, color }));
  }, [knownCategories]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <SafeAreaView style={styles.flex}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.modalCancel}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{t('wiki.newArticle')}</Text>
            <View style={{ width: 60 }} />
          </View>
          <Text style={styles.modalSub}>{t('wiki.moderationNote')}</Text>

          <ScrollView contentContainerStyle={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.label}>{t('wiki.category')} *</Text>
            <TextInput
              style={styles.input}
              placeholder={t('wiki.categoryHint')}
              placeholderTextColor="#94A3B8"
              value={form.category}
              onChangeText={text => set({ category: text })}
            />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {existingCategories.map(c => (
                <Pressable
                  key={c.key}
                  style={[
                    styles.catChip,
                    form.category === c.key && { backgroundColor: c.color, borderColor: c.color },
                  ]}
                  onPress={() => set({ category: c.key, categoryColor: c.color })}
                >
                  <Text style={[styles.catChipText, form.category === c.key && { color: '#fff' }]}>
                    {wikiCategoryLabel(c.key, lang)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('wiki.icon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pickerRow}>
              {ICON_OPTIONS.map(ic => (
                <Pressable
                  key={ic}
                  style={[
                    styles.iconBtn,
                    form.icon === ic && { backgroundColor: form.categoryColor + '30', borderColor: form.categoryColor },
                  ]}
                  onPress={() => set({ icon: ic })}
                >
                  <Ionicons name={ic as any} size={22} color={form.icon === ic ? form.categoryColor : '#64748B'} />
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.label}>{t('wiki.color')}</Text>
            <View style={styles.colorRow}>
              {COLOR_OPTIONS.map(c => (
                <Pressable
                  key={c}
                  style={[styles.colorDot, { backgroundColor: c }, form.categoryColor === c && styles.colorDotActive]}
                  onPress={() => set({ categoryColor: c })}
                />
              ))}
            </View>

            <Text style={styles.label}>{t('wiki.titleRu')} *</Text>
            <TextInput
              style={styles.input}
              placeholderTextColor="#94A3B8"
              value={form.titleRu}
              onChangeText={onTitleRu}
            />

            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>{t('wiki.autoTranslated')}</Text>
              {translating === 'title' && <ActivityIndicator size="small" color="#6366F1" />}
            </View>
            <TextInput style={styles.input} placeholder="EN" placeholderTextColor="#94A3B8"
              value={form.titleEn} onChangeText={text => set({ titleEn: text })} />
            <TextInput style={[styles.input, styles.inputGap]} placeholder="中文" placeholderTextColor="#94A3B8"
              value={form.titleZh} onChangeText={text => set({ titleZh: text })} />
            <TextInput style={[styles.input, styles.inputGap]} placeholder="Монгол" placeholderTextColor="#94A3B8"
              value={form.titleMn} onChangeText={text => set({ titleMn: text })} />

            <Text style={styles.label}>{t('wiki.summaryRu')} *</Text>
            <TextInput
              style={[styles.input, styles.textarea]}
              placeholderTextColor="#94A3B8"
              value={form.summaryRu}
              onChangeText={onSummaryRu}
              multiline
            />

            <View style={styles.autoRow}>
              <Text style={styles.autoLabel}>{t('wiki.autoTranslated')}</Text>
              {translating === 'summary' && <ActivityIndicator size="small" color="#6366F1" />}
            </View>
            <TextInput style={[styles.input, styles.textarea]} placeholder="EN" placeholderTextColor="#94A3B8"
              value={form.summaryEn} onChangeText={text => set({ summaryEn: text })} multiline />
            <TextInput style={[styles.input, styles.textarea, styles.inputGap]} placeholder="中文" placeholderTextColor="#94A3B8"
              value={form.summaryZh} onChangeText={text => set({ summaryZh: text })} multiline />
            <TextInput style={[styles.input, styles.textarea, styles.inputGap]} placeholder="Монгол" placeholderTextColor="#94A3B8"
              value={form.summaryMn} onChangeText={text => set({ summaryMn: text })} multiline />

            <Text style={styles.label}>{t('wiki.contact')}</Text>
            <TextInput
              style={styles.input}
              placeholder="@telegram"
              placeholderTextColor="#94A3B8"
              value={form.contact}
              onChangeText={text => set({ contact: text })}
              autoCapitalize="none"
            />

            <Pressable
              style={[styles.submitBtn, { backgroundColor: form.categoryColor }]}
              onPress={submit}
              disabled={submitting}
            >
              {submitting
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.submitText}>{t('wiki.submit')}</Text>}
            </Pressable>
            <View style={{ height: 40 }} />
          </ScrollView>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  flex: { flex: 1, backgroundColor: '#fff' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  title: { flex: 1, fontSize: 26, fontWeight: '800', color: '#1E293B' },
  badge: { backgroundColor: '#015197', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 34, alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  sliderWrap: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 8, borderWidth: 1.5, borderRadius: 16, paddingVertical: 4, paddingHorizontal: 2 },
  arrowBtn: { paddingHorizontal: 6 },
  arrow: { fontSize: 22, fontWeight: '700', lineHeight: 26 },
  chipScroll: { flex: 1 },
  chips: { flexDirection: 'row', gap: 6, paddingHorizontal: 4, alignItems: 'center' },
  chip: { height: 32, paddingHorizontal: 14, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  chipOff: { backgroundColor: '#F1F5F9' },
  chipLabel: { fontSize: 13, fontWeight: '700', color: '#fff' },
  chipLabelOff: { color: '#475569' },
  addChip: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: '#015197', borderStyle: 'dashed' },

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardPressed: { transform: [{ scale: 0.99 }], backgroundColor: '#FAFBFC' },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardMeta: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  pillText: { fontSize: 11, fontWeight: '700' },
  readTime: { fontSize: 11, color: '#94A3B8' },
  communityTag: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  communityTagText: { fontSize: 10, color: '#64748B' },
  cardTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B', marginBottom: 6 },
  cardSummary: { fontSize: 13, color: '#64748B', lineHeight: 19 },
  readMore: { fontSize: 13, fontWeight: '600', marginTop: 12 },

  readerContainer: { flex: 1, backgroundColor: '#F8FAFC' },
  readerHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  readerClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
  readerCat: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  readerCatText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  readerBody: { padding: 20 },
  readerTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginBottom: 16, lineHeight: 32 },
  readerText: { fontSize: 15, lineHeight: 25, color: '#334155' },

  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  modalCancel: { fontSize: 15, color: '#64748B', minWidth: 60 },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  modalSub: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginBottom: 8, paddingHorizontal: 16 },
  modalBody: { paddingHorizontal: 16, gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#1E293B' },
  inputGap: { marginTop: 6 },
  textarea: { minHeight: 76, textAlignVertical: 'top' },
  pickerRow: { marginTop: 6 },
  catChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', marginRight: 6 },
  catChipText: { fontSize: 12, fontWeight: '600', color: '#475569' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent', marginRight: 6 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  colorDot: { width: 30, height: 30, borderRadius: 15 },
  colorDotActive: { borderWidth: 3, borderColor: '#1E293B' },
  autoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, marginBottom: 4 },
  autoLabel: { fontSize: 12, fontWeight: '700', color: '#6366F1', textTransform: 'uppercase', letterSpacing: 0.3 },
  submitBtn: { alignItems: 'center', justifyContent: 'center', borderRadius: 14, paddingVertical: 14, marginTop: 20 },
  submitText: { fontSize: 15, fontWeight: '700', color: '#fff' },
});
