import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type OrderStatus } from '@/services/api';

const BRAND = '#015197';

const STATUS_FILTERS: { key: OrderStatus | 'all'; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'new', label: 'Новые' },
  { key: 'accepted', label: 'Принятые' },
  { key: 'declined', label: 'Отклонённые' },
  { key: 'completed', label: 'Завершённые' },
  { key: 'cancelled', label: 'Отменённые' },
];

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#0EA5E9', accepted: '#10B981', declined: '#EF4444', completed: '#64748B', cancelled: '#94A3B8',
};
const STATUS_LABEL: Record<OrderStatus, string> = {
  new: 'Новый', accepted: 'Принят', declined: 'Отклонён', completed: 'Завершён', cancelled: 'Отменён',
};

// Admin-only, read-only — same precedent as admin-welcome-videos.tsx and
// admin-partners.tsx. Changing an order's own status stays the partner's
// job in partner-dashboard.tsx; this screen only gives the admin visibility.
export default function AdminOrdersScreen() {
  const { user } = useAuth();
  const [filter, setFilter] = useState<OrderStatus | 'all'>('all');

  const isAdmin = ['admin', 'superadmin'].includes(user?.role || '');
  const ordersQ = useQuery({
    queryKey: ['admin-orders', filter],
    queryFn: () => api.getAdminOrders(filter === 'all' ? {} : { status: filter }),
    enabled: isAdmin,
  });
  const orders = ordersQ.data?.orders || [];

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: 'Брони' }} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color="#94A3B8" />
          <Text style={styles.noAccessText}>Нет доступа</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ title: 'Брони по всем партнёрам' }} />
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map(f => (
          <Pressable
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterChipText, filter === f.key && styles.filterChipTextActive]}>{f.label}</Text>
          </Pressable>
        ))}
      </View>
      {ordersQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={o => String(o.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Броней нет</Text>}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.cardTop}>
                <Text style={styles.cardPartner}>{item.partner_name}</Text>
                <View style={[styles.statusBadge, { backgroundColor: STATUS_COLOR[item.status] }]}>
                  <Text style={styles.statusBadgeText}>{STATUS_LABEL[item.status]}</Text>
                </View>
              </View>
              <Text style={styles.cardCustomer}>{item.customer_name || '—'} {item.customer_phone ? `· ${item.customer_phone}` : ''}</Text>
              {!!item.price && <Text style={styles.cardPrice}>{item.price} {item.price_currency}</Text>}
              <Text style={styles.cardDate}>{new Date(item.created_at).toLocaleString('ru-RU')}</Text>
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
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 4 },
  filterChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  filterChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  filterChipText: { fontSize: 12, fontWeight: '600', color: '#334155' },
  filterChipTextActive: { color: '#fff' },
  list: { padding: 16, paddingTop: 8, gap: 10 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 24 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#F1F5F9', gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardPartner: { fontSize: 14, fontWeight: '800', color: '#1E293B' },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  statusBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  cardCustomer: { fontSize: 12, color: '#64748B' },
  cardPrice: { fontSize: 12, color: '#334155', fontWeight: '600' },
  cardDate: { fontSize: 11, color: '#94A3B8' },
});
