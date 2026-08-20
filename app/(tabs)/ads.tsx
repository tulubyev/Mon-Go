import { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet, Text, View, FlatList, Pressable, Modal, TextInput,
  ScrollView, ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';

const BASE_URL = 'https://mon-go.ru';

const CATEGORIES = [
  { key: 'trips',   label: 'Попутчики', icon: '✈️' },
  { key: 'housing', label: 'Жильё',     icon: '🏠' },
  { key: 'sell',    label: 'Продам',    icon: '🛍️' },
  { key: 'search',  label: 'Ищу',       icon: '🔍' },
] as const;

type Category = typeof CATEGORIES[number]['key'];

interface Ad {
  id: number;
  username?: string;
  first_name?: string;
  title: string;
  description: string;
  contact?: string;
  created_at: string;
  lat?: number;
  lng?: number;
  address?: string;
}

async function fetchAds(category: Category): Promise<Ad[]> {
  const res = await fetch(`${BASE_URL}/api/ads?category=${category}`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  return res.json();
}

async function postAd(data: {
  category: Category; title: string; description: string; contact: string;
  lat?: number; lng?: number; address?: string;
}): Promise<{ success: boolean; id?: number; error?: string }> {
  const res = await fetch(`${BASE_URL}/api/ads`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return res.json();
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return 'только что';
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d} д назад`;
  return `${Math.floor(d / 30)} мес назад`;
}

export default function AdsScreen() {
  const [activeCategory, setActiveCategory] = useState<Category>('trips');
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (cat: Category, silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await fetchAds(cat);
      setAds(data);
    } catch {
      setAds([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(activeCategory); }, [activeCategory]);

  const onRefresh = () => { setRefreshing(true); load(activeCategory, true); };

  return (
    <View style={styles.container}>
      {/* Category tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map(cat => (
          <Pressable
            key={cat.key}
            style={[styles.catChip, activeCategory === cat.key && styles.catChipActive]}
            onPress={() => setActiveCategory(cat.key)}
          >
            <Text style={styles.catIcon}>{cat.icon}</Text>
            <Text style={[styles.catLabel, activeCategory === cat.key && styles.catLabelActive]}>{cat.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* List */}
      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <FlatList
          data={ads}
          keyExtractor={a => String(a.id)}
          contentContainerStyle={ads.length === 0 ? styles.emptyContainer : styles.list}
          refreshing={refreshing}
          onRefresh={onRefresh}
          ListEmptyComponent={<EmptyState category={activeCategory} onPost={() => setShowForm(true)} />}
          renderItem={({ item }) => <AdCard ad={item} />}
        />
      )}

      {/* FAB */}
      <Pressable style={styles.fab} onPress={() => setShowForm(true)}>
        <Text style={styles.fabText}>＋</Text>
      </Pressable>

      {/* Create Ad modal */}
      <CreateAdModal
        visible={showForm}
        category={activeCategory}
        onClose={() => setShowForm(false)}
        onSuccess={() => { setShowForm(false); load(activeCategory); }}
      />
    </View>
  );
}

function AdCard({ ad }: { ad: Ad }) {
  const author = ad.first_name || ad.username || 'Аноним';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{ad.title}</Text>
        <Text style={styles.cardTime}>{timeAgo(ad.created_at)}</Text>
      </View>
      <Text style={styles.cardDesc} numberOfLines={3}>{ad.description}</Text>
      {ad.address && <Text style={styles.cardAddress}>📍 {ad.address}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.cardAuthor}>👤 {author}</Text>
        {ad.contact && <Text style={styles.cardContact}>📞 {ad.contact}</Text>}
      </View>
    </View>
  );
}

function EmptyState({ category, onPost }: { category: Category; onPost: () => void }) {
  const cat = CATEGORIES.find(c => c.key === category)!;
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{cat.icon}</Text>
      <Text style={styles.emptyTitle}>Нет объявлений в «{cat.label}»</Text>
      <Text style={styles.emptySub}>Будьте первым — разместите объявление</Text>
      <Pressable style={styles.emptyBtn} onPress={onPost}>
        <Text style={styles.emptyBtnText}>＋ Разместить</Text>
      </Pressable>
    </View>
  );
}

function CreateAdModal({
  visible, category, onClose, onSuccess,
}: { visible: boolean; category: Category; onClose: () => void; onSuccess: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [contact, setContact] = useState('');
  const [address, setAddress] = useState('');
  const [selectedCat, setSelectedCat] = useState<Category>(category);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => { setSelectedCat(category); }, [category]);

  const reset = () => { setTitle(''); setDescription(''); setContact(''); setAddress(''); };

  const submit = async () => {
    if (title.trim().length < 3) { Alert.alert('Ошибка', 'Заголовок минимум 3 символа'); return; }
    if (description.trim().length < 3) { Alert.alert('Ошибка', 'Описание минимум 3 символа'); return; }
    setSubmitting(true);
    try {
      const result = await postAd({
        category: selectedCat,
        title: title.trim(),
        description: description.trim(),
        contact: contact.trim(),
        address: address.trim() || undefined,
      });
      if (result.success) {
        reset();
        onSuccess();
      } else {
        Alert.alert('Ошибка', result.error || 'Не удалось разместить');
      }
    } catch {
      Alert.alert('Ошибка', 'Нет подключения к серверу');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView style={styles.modal} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.modalHeader}>
          <Pressable onPress={() => { reset(); onClose(); }}>
            <Text style={styles.modalCancel}>Отмена</Text>
          </Pressable>
          <Text style={styles.modalTitle}>Новое объявление</Text>
          <Pressable onPress={submit} disabled={submitting}>
            <Text style={[styles.modalPost, submitting && styles.modalPostDisabled]}>
              {submitting ? '...' : 'Разместить'}
            </Text>
          </Pressable>
        </View>

        <ScrollView style={styles.modalScroll} contentContainerStyle={styles.modalContent}>
          {/* Category picker */}
          <Text style={styles.fieldLabel}>Категория</Text>
          <View style={styles.catPicker}>
            {CATEGORIES.map(cat => (
              <Pressable
                key={cat.key}
                style={[styles.catPickChip, selectedCat === cat.key && styles.catPickChipActive]}
                onPress={() => setSelectedCat(cat.key)}
              >
                <Text style={styles.catPickIcon}>{cat.icon}</Text>
                <Text style={[styles.catPickLabel, selectedCat === cat.key && styles.catPickLabelActive]}>{cat.label}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.fieldLabel}>Заголовок *</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="Краткое описание (до 80 символов)"
            maxLength={80}
            placeholderTextColor="#aaa"
          />

          <Text style={styles.fieldLabel}>Подробности *</Text>
          <TextInput
            style={[styles.input, styles.inputMulti]}
            value={description}
            onChangeText={setDescription}
            placeholder="Подробное описание (до 500 символов)"
            maxLength={500}
            multiline
            numberOfLines={4}
            placeholderTextColor="#aaa"
          />

          <Text style={styles.fieldLabel}>Контакт (Telegram, телефон)</Text>
          <TextInput
            style={styles.input}
            value={contact}
            onChangeText={setContact}
            placeholder="@username или +976..."
            placeholderTextColor="#aaa"
          />

          <Text style={styles.fieldLabel}>Место (необязательно)</Text>
          <TextInput
            style={styles.input}
            value={address}
            onChangeText={setAddress}
            placeholder="Улан-Батор, Сухбаатарын талбай..."
            placeholderTextColor="#aaa"
          />

          <Text style={styles.ruleNote}>
            ℹ️ Объявление активно 30 дней. Максимум 3 объявления в сутки.{'\n'}
            Не указывайте личные данные в описании.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  catBar: { maxHeight: 52, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee' },
  catContent: { paddingHorizontal: 10, alignItems: 'center', gap: 6, paddingVertical: 8 },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16, backgroundColor: '#f5f5f5', borderWidth: 1, borderColor: '#eee' },
  catChipActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  catIcon: { fontSize: 13 },
  catLabel: { fontSize: 12, fontWeight: '600', color: '#555' },
  catLabelActive: { color: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  list: { padding: 12, gap: 10 },
  emptyContainer: { flex: 1 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1, marginRight: 8 },
  cardTime: { fontSize: 11, color: '#aaa', flexShrink: 0 },
  cardDesc: { fontSize: 13, color: '#555', lineHeight: 19, marginBottom: 8 },
  cardAddress: { fontSize: 12, color: '#3b82f6', marginBottom: 6 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardAuthor: { fontSize: 12, color: '#888' },
  cardContact: { fontSize: 12, color: '#3b82f6', fontWeight: '600' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyIcon: { fontSize: 56 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center' },
  emptyBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 24, paddingVertical: 11, borderRadius: 12, marginTop: 4 },
  emptyBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fab: { position: 'absolute', bottom: 24, right: 20, width: 56, height: 56, borderRadius: 28, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
  fabText: { color: '#fff', fontSize: 28, lineHeight: 32 },
  // Modal
  modal: { flex: 1, backgroundColor: '#fff' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalCancel: { fontSize: 15, color: '#888' },
  modalTitle: { fontSize: 16, fontWeight: '700' },
  modalPost: { fontSize: 15, color: '#3b82f6', fontWeight: '700' },
  modalPostDisabled: { color: '#aaa' },
  modalScroll: { flex: 1 },
  modalContent: { padding: 16, gap: 4, paddingBottom: 40 },
  fieldLabel: { fontSize: 12, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 12, marginBottom: 4 },
  input: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee' },
  inputMulti: { minHeight: 100, textAlignVertical: 'top' },
  catPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  catPickChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: '#f5f5f5', borderWidth: 1.5, borderColor: '#eee' },
  catPickChipActive: { backgroundColor: '#eff6ff', borderColor: '#3b82f6' },
  catPickIcon: { fontSize: 14 },
  catPickLabel: { fontSize: 13, fontWeight: '600', color: '#555' },
  catPickLabelActive: { color: '#3b82f6' },
  ruleNote: { fontSize: 12, color: '#aaa', lineHeight: 18, marginTop: 16, textAlign: 'center' },
});
