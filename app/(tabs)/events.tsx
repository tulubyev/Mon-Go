import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, FlatList, ScrollView, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type EventItem, type AttendStatus } from '@/services/api';

const BRAND = '#015197';

const CATEGORIES = [
  { key: 'all', label: 'Все', emoji: '📅' },
  { key: 'festival', label: 'Фестивали', emoji: '🎉' },
  { key: 'concert', label: 'Концерты', emoji: '🎶' },
  { key: 'sport', label: 'Спорт', emoji: '⛷️' },
  { key: 'tour', label: 'Туры', emoji: '🗺️' },
  { key: 'exhibition', label: 'Выставки', emoji: '🏆' },
  { key: 'food', label: 'Гастрономия', emoji: '🍽️' },
  { key: 'culture', label: 'Культура', emoji: '🎭' },
  { key: 'nature', label: 'Природа', emoji: '🌿' },
] as const;

export default function EventsScreen() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const tabBarHeight = useBottomTabBarHeight();
  const [category, setCategory] = useState('all');
  const [showCreate, setShowCreate] = useState(false);

  const eventsQ = useQuery({
    queryKey: ['events', category],
    queryFn: () => api.getEvents({ category: category === 'all' ? undefined : category, from: new Date().toISOString() }),
  });

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) { router.push('/(auth)/login' as any); return; }
    action();
  };

  const attend = async (event: EventItem, status: AttendStatus) => {
    if (!isAuthenticated) { requireAuth(() => {}); return; }
    try {
      await api.attendEvent(event.id, status);
      qc.invalidateQueries({ queryKey: ['events'] });
    } catch (e: any) { Alert.alert('Ошибка', e.message); }
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎉 События</Text>
        <View style={styles.headerBtns}>
          <Pressable style={styles.calBtn} onPress={() => router.push('/calendar' as any)}>
            <Ionicons name="calendar-outline" size={18} color={BRAND} />
          </Pressable>
          <Pressable style={styles.uploadBtn} onPress={() => requireAuth(() => setShowCreate(true))}>
            <Ionicons name="add" size={20} color="#fff" />
          </Pressable>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.catBar} contentContainerStyle={styles.catContent}>
        {CATEGORIES.map(c => {
          const active = c.key === category;
          return (
            <Pressable key={c.key} style={[styles.catChip, active && styles.catChipActive]} onPress={() => setCategory(c.key)}>
              <Text style={styles.catEmoji}>{c.emoji}</Text>
              <Text style={[styles.catLabel, active && styles.catLabelActive]}>{c.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {eventsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : !eventsQ.data?.events.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🗓️</Text>
          <Text style={styles.emptyTitle}>Событий пока нет</Text>
          <Text style={styles.emptySub}>Добавьте первое — фестиваль, тур или встречу</Text>
        </View>
      ) : (
        <FlatList
          data={eventsQ.data.events}
          keyExtractor={e => String(e.id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
          refreshing={eventsQ.isRefetching}
          onRefresh={eventsQ.refetch}
          renderItem={({ item }) => <EventCard event={item} onAttend={attend} />}
        />
      )}

      {showCreate && (
        <CreateEventModal
          onClose={() => setShowCreate(false)}
          onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['events'] }); }}
        />
      )}
    </SafeAreaView>
  );
}

function EventCard({ event, onAttend }: { event: EventItem; onAttend: (e: EventItem, s: AttendStatus) => void }) {
  const date = new Date(event.start_date);
  const dateLabel = date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
  const timeLabel = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.cardEmoji}>{event.emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle} numberOfLines={2}>{event.title}</Text>
          <Text style={styles.cardDate}>{dateLabel} · {timeLabel}</Text>
          {!!event.location && <Text style={styles.cardLocation} numberOfLines={1}>📍 {event.location}</Text>}
        </View>
      </View>
      {!!event.description && <Text style={styles.cardDesc} numberOfLines={3}>{event.description}</Text>}
      <View style={styles.cardFooter}>
        <Text style={styles.attendeeText}>👥 {event.attendee_count}</Text>
        <View style={styles.attendBtns}>
          <Pressable style={styles.attendBtn} onPress={() => onAttend(event, 'interested')}>
            <Text style={styles.attendBtnText}>Интересно</Text>
          </Pressable>
          <Pressable style={[styles.attendBtn, styles.attendBtnPrimary]} onPress={() => onAttend(event, 'going')}>
            <Text style={[styles.attendBtnText, styles.attendBtnTextPrimary]}>Иду</Text>
          </Pressable>
        </View>
      </View>
      {!!event.external_url && (
        <Pressable style={styles.linkRow} onPress={() => Linking.openURL(event.external_url!)}>
          <Ionicons name="link-outline" size={13} color={BRAND} />
          <Text style={styles.linkText}>Подробнее</Text>
        </Pressable>
      )}
    </View>
  );
}

function CreateEventModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [location, setLocation] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(new Date(Date.now() + 24 * 3600_000));
  const [showPicker, setShowPicker] = useState<'date' | 'time' | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2;

  const onPickerChange = (_: any, selected?: Date) => {
    setShowPicker(Platform.OS === 'ios' ? showPicker : null);
    if (!selected) return;
    setDate(prev => {
      const next = new Date(prev);
      if (showPicker === 'date') { next.setFullYear(selected.getFullYear(), selected.getMonth(), selected.getDate()); }
      else { next.setHours(selected.getHours(), selected.getMinutes()); }
      return next;
    });
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.createEvent({
        title: title.trim(),
        category,
        start_date: date.toISOString(),
        location: location.trim() || undefined,
        description: description.trim() || undefined,
      });
      onDone();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось создать событие');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Новое событие</Text>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>

          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название" placeholderTextColor="#94A3B8" maxLength={100} />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 10 }}>
            {CATEGORIES.filter(c => c.key !== 'all').map(c => (
              <Pressable key={c.key} style={[styles.catChip, category === c.key && styles.catChipActive]} onPress={() => setCategory(c.key)}>
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={[styles.catLabel, category === c.key && styles.catLabelActive]}>{c.label}</Text>
              </Pressable>
            ))}
          </ScrollView>

          <View style={styles.dateRow}>
            <Pressable style={styles.dateBtn} onPress={() => setShowPicker('date')}>
              <Ionicons name="calendar-outline" size={16} color={BRAND} />
              <Text style={styles.dateBtnText}>{date.toLocaleDateString('ru-RU')}</Text>
            </Pressable>
            <Pressable style={styles.dateBtn} onPress={() => setShowPicker('time')}>
              <Ionicons name="time-outline" size={16} color={BRAND} />
              <Text style={styles.dateBtnText}>{date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</Text>
            </Pressable>
          </View>
          {showPicker && (
            <DateTimePicker
              value={date}
              mode={showPicker}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onPickerChange}
            />
          )}

          <TextInput style={styles.input} value={location} onChangeText={setLocation} placeholder="Место (необязательно)" placeholderTextColor="#94A3B8" />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Описание (необязательно)"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={500}
          />

          <Pressable style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={submit} disabled={!canSubmit || submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Создать</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  headerBtns: { flexDirection: 'row', gap: 8 },
  calBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' },
  uploadBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  catBar: { maxHeight: 44, marginBottom: 8 },
  catContent: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  catChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  catEmoji: { fontSize: 13 },
  catLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  catLabelActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  cardEmoji: { fontSize: 28 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardDate: { fontSize: 12, color: BRAND, fontWeight: '600', marginTop: 2 },
  cardLocation: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  attendeeText: { fontSize: 12, color: '#94A3B8', fontWeight: '600' },
  attendBtns: { flexDirection: 'row', gap: 8 },
  attendBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F1F5F9' },
  attendBtnPrimary: { backgroundColor: BRAND },
  attendBtnText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  attendBtnTextPrimary: { color: '#fff' },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  linkText: { fontSize: 12, fontWeight: '600', color: BRAND },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, maxHeight: '90%' },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', marginBottom: 10 },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  dateRow: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  dateBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 11 },
  dateBtnText: { fontSize: 14, fontWeight: '600', color: BRAND },
  submitBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
