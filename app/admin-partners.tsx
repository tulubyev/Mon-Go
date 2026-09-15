import { StyleSheet, Text, View, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type PartnerProfile } from '@/services/api';

const BRAND = '#015197';

// Admin-only screen — same precedent as admin-welcome-videos.tsx: no
// dedicated tab, reached only from Settings' menu when the signed-in
// user's role qualifies. RU-only, matching every other admin screen here.
export default function AdminPartnersScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const isAdmin = user?.role === 'admin';
  const partnersQ = useQuery({
    queryKey: ['admin-partners-pending'],
    queryFn: () => api.getPendingPartners(),
    enabled: isAdmin,
  });
  const partners = partnersQ.data?.partners || [];

  const decide = async (partner: PartnerProfile, status: 'approved' | 'rejected') => {
    try {
      await api.setPartnerStatus(partner.id, status);
      qc.invalidateQueries({ queryKey: ['admin-partners-pending'] });
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось обновить заявку');
    }
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: 'Заявки в партнёры' }} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color="#94A3B8" />
          <Text style={styles.noAccessText}>Нет доступа</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ title: 'Заявки в партнёры' }} />
      {partnersQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={partners}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Заявок нет</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.cardName}>{item.name}</Text>
              {!!item.type && <Text style={styles.cardMeta}>{item.type}</Text>}
              {!!item.phone && <Text style={styles.cardMeta}>{item.phone}</Text>}
              {!!item.email && <Text style={styles.cardMeta}>{item.email}</Text>}
              {!!item.description_ru && <Text style={styles.cardDesc} numberOfLines={3}>{item.description_ru}</Text>}
              <View style={styles.actions}>
                <Pressable style={[styles.actBtn, styles.approveBtn]} onPress={() => decide(item, 'approved')}>
                  <Text style={styles.actBtnText}>Одобрить</Text>
                </Pressable>
                <Pressable style={[styles.actBtn, styles.rejectBtn]} onPress={() => decide(item, 'rejected')}>
                  <Text style={styles.actBtnText}>Отклонить</Text>
                </Pressable>
              </View>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noAccessText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },
  list: { padding: 16, gap: 10 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 4 },
  cardName: { fontSize: 15, fontWeight: '800', color: '#1E293B' },
  cardMeta: { fontSize: 12, color: '#64748B' },
  cardDesc: { fontSize: 12, color: '#334155', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  actBtn: { flex: 1, height: 38, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  approveBtn: { backgroundColor: '#10B981' },
  rejectBtn: { backgroundColor: '#EF4444' },
  actBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
});
