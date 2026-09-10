import {
  StyleSheet, Text, View, ActivityIndicator, ScrollView, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, type OrderStatus } from '@/services/api';

const BRAND = '#015197';

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#0EA5E9',
  accepted: '#10B981',
  declined: '#EF4444',
  completed: '#64748B',
  cancelled: '#94A3B8',
};

export default function MyOrdersScreen() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['my-orders'], queryFn: () => api.getMyOrders() });

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      {q.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : !q.data?.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📋</Text>
          <Text style={styles.emptyNote}>{t('orders.empty')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}
        >
          {q.data.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.partner} numberOfLines={1}>{o.partner_name || '—'}</Text>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[o.status] + '18' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[o.status] }]}>
                    {t(`orders.status.${o.status}`)}
                  </Text>
                </View>
              </View>
              {!!o.service_title && <Text style={styles.service}>{o.service_title}</Text>}
              {!!o.message && <Text style={styles.cardSub}>{o.message}</Text>}
              {o.price != null && <Text style={styles.price}>{o.price} {o.price_currency}</Text>}
              {!!o.partner_note && (
                <View style={styles.replyBox}>
                  <Text style={styles.replyLabel}>{t('orders.partnerReply')}</Text>
                  <Text style={styles.replyText}>{o.partner_note}</Text>
                </View>
              )}
              <Text style={styles.date}>{new Date(o.created_at).toLocaleDateString()}</Text>
            </View>
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

  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  partner: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B' },
  service: { fontSize: 13, fontWeight: '600', color: BRAND },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  price: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  date: { fontSize: 11, color: '#94A3B8', marginTop: 2 },

  statusPill: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },

  replyBox: { backgroundColor: '#F1F5F9', borderRadius: 10, padding: 10, marginTop: 4 },
  replyLabel: { fontSize: 11, fontWeight: '700', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 },
  replyText: { fontSize: 13, color: '#334155', lineHeight: 18 },
});
