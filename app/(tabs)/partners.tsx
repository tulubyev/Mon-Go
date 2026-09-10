import { useState } from 'react';
import {
  StyleSheet, ScrollView, Pressable, Text, View, TextInput, Modal,
  Linking, ActivityIndicator, RefreshControl, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Partner } from '@/services/api';

const TYPES = [
  { key: 'all',         icon: 'grid',        color: '#015197' },
  { key: 'tour_agency', icon: 'compass',     color: '#0EA5E9' },
  { key: 'guide',       icon: 'person',      color: '#10B981' },
  { key: 'hotel',       icon: 'bed',         color: '#F97316' },
  { key: 'car_rental',  icon: 'car-sport',   color: '#EF4444' },
  { key: 'visa',        icon: 'document-text', color: '#8B5CF6' },
] as const;

const TIER_BADGE: Record<string, { label: string; color: string }> = {
  premium: { label: 'PREMIUM', color: '#D97706' },
  basic:   { label: 'BASIC',   color: '#0EA5E9' },
};

export default function PartnersScreen() {
  const { t, i18n } = useTranslation();
  const { isAuthenticated } = useAuth();
  const lang = i18n.language || 'ru';
  const tabBarHeight = useBottomTabBarHeight();
  const [type, setType] = useState<string>('all');
  const [orderPartner, setOrderPartner] = useState<Partner | null>(null);

  const startOrder = (p: Partner) => {
    if (!isAuthenticated) {
      router.push('/(auth)/login' as any);
      return;
    }
    setOrderPartner(p);
  };

  const { data: partners, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['partners', type, lang],
    queryFn: () => api.getPartners(type === 'all' ? undefined : type, lang),
    staleTime: 5 * 60_000,
    // Keep the last successful list on screen when the network drops — Mongolia
    // has no coverage outside the cities, and a stale directory beats an empty one.
    placeholderData: prev => prev,
  });

  const open = (url: string) => Linking.openURL(url).catch(() => {});

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('partners.title')}</Text>
        {!!partners?.length && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{partners.length}</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.typeRow}
        style={styles.typeScroll}
      >
        {TYPES.map(item => {
          const active = item.key === type;
          return (
            <Pressable
              key={item.key}
              style={[styles.typeChip, active && { backgroundColor: item.color, borderColor: item.color }]}
              onPress={() => setType(item.key)}
            >
              <Ionicons name={item.icon as any} size={15} color={active ? '#fff' : item.color} />
              <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>
                {t(`partners.types.${item.key}`)}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#015197" />
        </View>
      ) : !partners?.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🤝</Text>
          <Text style={styles.emptyTitle}>{t('partners.empty')}</Text>
          <Text style={styles.emptySub}>{t('partners.emptySub')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
        >
          {partners.map(p => (
            <PartnerCard key={p.id} partner={p} onOpen={open} onOrder={startOrder} />
          ))}
          <View style={{ height: 24 }} />
        </ScrollView>
      )}

      {orderPartner && (
        <OrderModal partner={orderPartner} onClose={() => setOrderPartner(null)} />
      )}
    </SafeAreaView>
  );
}

function OrderModal({ partner, onClose }: { partner: Partner; onClose: () => void }) {
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (sending) return;
    setSending(true);
    try {
      await api.createOrder({ partnerId: partner.id, message: message.trim() || undefined });
      onClose();
      Alert.alert('', t('orders.placed'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{t('orders.placeTitle')}</Text>
              <Text style={styles.modalSub} numberOfLines={1}>{partner.name}</Text>
            </View>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>

          <Text style={styles.modalLabel}>{t('orders.messageLabel')}</Text>
          <TextInput
            style={styles.modalInput}
            value={message}
            onChangeText={setMessage}
            multiline
            autoFocus
            placeholder={t('orders.messagePlaceholder')}
            placeholderTextColor="#94A3B8"
          />

          <Pressable style={[styles.modalBtn, sending && styles.modalBtnDisabled]} onPress={send} disabled={sending}>
            {sending ? <ActivityIndicator color="#fff" /> : (
              <>
                <Ionicons name="paper-plane" size={16} color="#fff" />
                <Text style={styles.modalBtnText}>{t('orders.send')}</Text>
              </>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function PartnerCard({ partner, onOpen, onOrder }: { partner: Partner; onOpen: (url: string) => void; onOrder: (p: Partner) => void }) {
  const { t } = useTranslation();
  const tier = partner.subscription_tier ? TIER_BADGE[partner.subscription_tier] : undefined;
  const typeMeta = TYPES.find(item => item.key === partner.type);
  const accent = typeMeta?.color ?? '#015197';

  return (
    <View style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.logoBox, { backgroundColor: accent + '18' }]}>
          <Ionicons name={(typeMeta?.icon ?? 'business') as any} size={22} color={accent} />
        </View>
        <View style={styles.cardHead}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={2}>{partner.name}</Text>
            {partner.verified && <Ionicons name="checkmark-circle" size={16} color="#10B981" />}
          </View>
          {tier && (
            <View style={[styles.tierPill, { backgroundColor: tier.color + '18' }]}>
              <Text style={[styles.tierText, { color: tier.color }]}>{tier.label}</Text>
            </View>
          )}
        </View>
      </View>

      {!!partner.description && (
        <Text style={styles.description} numberOfLines={4}>{partner.description}</Text>
      )}

      {!!partner.address && (
        <View style={styles.metaRow}>
          <Ionicons name="location-outline" size={14} color="#94A3B8" />
          <Text style={styles.metaText} numberOfLines={2}>{partner.address}</Text>
        </View>
      )}

      <View style={styles.actions}>
        {!!partner.phone && (
          <Pressable style={[styles.action, { backgroundColor: '#10B98118' }]}
            onPress={() => onOpen(`tel:${partner.phone!.replace(/\s/g, '')}`)}>
            <Ionicons name="call" size={15} color="#10B981" />
            <Text style={[styles.actionText, { color: '#10B981' }]}>{t('partners.call')}</Text>
          </Pressable>
        )}
        {!!partner.telegram && (
          <Pressable style={[styles.action, { backgroundColor: '#0EA5E918' }]}
            onPress={() => onOpen(`https://t.me/${partner.telegram!.replace(/^@/, '')}`)}>
            <Ionicons name="paper-plane" size={15} color="#0EA5E9" />
            <Text style={[styles.actionText, { color: '#0EA5E9' }]}>Telegram</Text>
          </Pressable>
        )}
        {!!partner.whatsapp && (
          <Pressable style={[styles.action, { backgroundColor: '#22C55E18' }]}
            onPress={() => onOpen(`https://wa.me/${partner.whatsapp!.replace(/\D/g, '')}`)}>
            <Ionicons name="logo-whatsapp" size={15} color="#22C55E" />
            <Text style={[styles.actionText, { color: '#22C55E' }]}>WhatsApp</Text>
          </Pressable>
        )}
        {!!partner.url && (
          <Pressable style={[styles.action, { backgroundColor: '#64748B18' }]}
            onPress={() => onOpen(partner.url!)}>
            <Ionicons name="globe-outline" size={15} color="#64748B" />
            <Text style={[styles.actionText, { color: '#64748B' }]}>{t('partners.website')}</Text>
          </Pressable>
        )}
      </View>

      <Pressable style={styles.orderBtn} onPress={() => onOrder(partner)}>
        <Ionicons name="bag-check-outline" size={16} color="#fff" />
        <Text style={styles.orderBtnText}>{t('orders.place')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
  title: { flex: 1, fontSize: 26, fontWeight: '800', color: '#1E293B' },
  badge: { backgroundColor: '#015197', borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4, minWidth: 34, alignItems: 'center' },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  typeScroll: { maxHeight: 46, marginBottom: 4 },
  typeRow: { paddingHorizontal: 16, gap: 8, alignItems: 'center' },
  typeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 13, height: 34, borderRadius: 17,
    borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff',
  },
  typeLabel: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeLabelActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#94A3B8', textAlign: 'center', lineHeight: 20 },

  list: { paddingHorizontal: 16, paddingTop: 8, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  logoBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardHead: { flex: 1, gap: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: '#1E293B' },
  tierPill: { alignSelf: 'flex-start', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  tierText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },

  description: { fontSize: 13, color: '#64748B', lineHeight: 19, marginTop: 12 },
  metaRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 5, marginTop: 10 },
  metaText: { flex: 1, fontSize: 12, color: '#94A3B8', lineHeight: 17 },

  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  action: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 10 },
  actionText: { fontSize: 12, fontWeight: '700' },

  orderBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 12, backgroundColor: '#015197', borderRadius: 12, paddingVertical: 11 },
  orderBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 8 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  modalSub: { fontSize: 13, color: '#64748B', marginTop: 2 },
  modalLabel: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 6 },
  modalInput: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', minHeight: 96, textAlignVertical: 'top' },
  modalBtn: { flexDirection: 'row', gap: 8, backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  modalBtnDisabled: { backgroundColor: '#94A3B8' },
  modalBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
