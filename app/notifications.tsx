import {
  StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/services/api';

const BRAND = '#015197';

export default function NotificationsScreen() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['notifications'], queryFn: () => api.getNotifications() });

  const hasUnread = !!q.data?.some(n => !n.read);

  const readAll = async () => {
    await api.markAllNotificationsRead();
    q.refetch();
  };

  const tap = async (id: number, read: boolean) => {
    if (read) return;
    await api.markNotificationRead(id);
    q.refetch();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {hasUnread && (
        <Pressable style={styles.readAll} onPress={readAll}>
          <Ionicons name="checkmark-done" size={16} color={BRAND} />
          <Text style={styles.readAllText}>{t('notifications.readAll')}</Text>
        </Pressable>
      )}

      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : !q.data?.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🔔</Text>
          <Text style={styles.emptyNote}>{t('notifications.empty')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}
        >
          {q.data.map(n => (
            <Pressable
              key={n.id}
              style={[styles.card, !n.read && styles.cardUnread]}
              onPress={() => tap(n.id, n.read)}
            >
              {!n.read && <View style={styles.dot} />}
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle}>{n.title}</Text>
                {!!n.body && <Text style={styles.cardSub}>{n.body}</Text>}
                <Text style={styles.date}>{new Date(n.created_at).toLocaleString()}</Text>
              </View>
            </Pressable>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 32 },
  emptyEmoji: { fontSize: 40 },
  emptyNote: { fontSize: 14, color: '#94A3B8', textAlign: 'center' },

  readAll: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  readAllText: { fontSize: 13, fontWeight: '700', color: BRAND },

  list: { padding: 16, gap: 10 },
  card: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: 14, padding: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardUnread: { backgroundColor: '#F0F7FF' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: BRAND, marginTop: 6 },
  cardBody: { flex: 1, gap: 3 },
  cardTitle: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  date: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
});
