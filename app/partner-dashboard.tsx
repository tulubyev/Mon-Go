import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, ActivityIndicator, ScrollView,
  TextInput, Modal, Alert, KeyboardAvoidingView, Platform, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  api, type PartnerProfile, type PartnerService, type PartnerServiceInput,
  type Order, type OrderStatus,
} from '@/services/api';

const BRAND = '#015197';

const STATUS_COLOR: Record<OrderStatus, string> = {
  new: '#0EA5E9',
  accepted: '#10B981',
  declined: '#EF4444',
  completed: '#64748B',
  cancelled: '#94A3B8',
};

export default function PartnerDashboardScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [tab, setTab] = useState<'services' | 'orders'>('services');

  const meQ = useQuery({ queryKey: ['partner-me'], queryFn: () => api.getPartnerMe() });

  if (meQ.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>;
  }
  const partner = meQ.data;
  if (!partner) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyTitle}>{t('partner.become')}</Text>
        <Pressable style={styles.primaryBtn} onPress={() => router.replace('/partner-apply' as any)}>
          <Text style={styles.primaryBtnText}>{t('partner.applyTitle')}</Text>
        </Pressable>
      </View>
    );
  }

  const statusMeta: Record<PartnerProfile['status'], { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
    pending: { label: t('partner.statusPending'), color: '#D97706', icon: 'time-outline' },
    approved: { label: t('partner.statusApproved'), color: '#10B981', icon: 'checkmark-circle' },
    rejected: { label: t('partner.statusRejected'), color: '#EF4444', icon: 'close-circle' },
  };
  const sm = statusMeta[partner.status];

  return (
    <SafeAreaView style={styles.screen} edges={['bottom']}>
      <View style={styles.headerCard}>
        <View style={styles.headerTop}>
          <Text style={styles.partnerName} numberOfLines={1}>{partner.name}</Text>
          <View style={[styles.statusPill, { backgroundColor: sm.color + '18' }]}>
            <Ionicons name={sm.icon} size={13} color={sm.color} />
            <Text style={[styles.statusText, { color: sm.color }]}>{sm.label}</Text>
          </View>
        </View>
        <Pressable style={styles.editLink} onPress={() => router.push('/partner-profile' as any)}>
          <Ionicons name="create-outline" size={15} color={BRAND} />
          <Text style={styles.editLinkText}>{t('partner.editProfile')}</Text>
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {(['services', 'orders'] as const).map(k => (
          <Pressable key={k} style={[styles.tab, tab === k && styles.tabActive]} onPress={() => setTab(k)}>
            <Text style={[styles.tabText, tab === k && styles.tabTextActive]}>
              {k === 'services' ? t('partner.tabServices') : t('partner.tabOrders')}
            </Text>
          </Pressable>
        ))}
      </View>

      {tab === 'services'
        ? <ServicesTab partnerId={partner.id} onChange={() => qc.invalidateQueries({ queryKey: ['partner-services'] })} />
        : <OrdersTab />}
    </SafeAreaView>
  );
}

/* ─────────────────────────── Services ─────────────────────────── */

function ServicesTab({ partnerId, onChange }: { partnerId: number; onChange: () => void }) {
  const { t } = useTranslation();
  const [editing, setEditing] = useState<PartnerService | 'new' | null>(null);

  const q = useQuery({ queryKey: ['partner-services'], queryFn: () => api.getPartnerServices() });

  const remove = (svc: PartnerService) => {
    Alert.alert(t('partner.deleteServiceTitle'), svc.title_ru || '', [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: async () => { await api.deletePartnerService(svc.id); q.refetch(); onChange(); },
      },
    ]);
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}
      >
        <Pressable style={styles.addBtn} onPress={() => setEditing('new')}>
          <Ionicons name="add" size={18} color={BRAND} />
          <Text style={styles.addBtnText}>{t('partner.addService')}</Text>
        </Pressable>

        {q.isLoading ? (
          <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
        ) : !q.data?.length ? (
          <Text style={styles.emptyNote}>{t('partner.noServices')}</Text>
        ) : (
          q.data.map(svc => (
            <View key={svc.id} style={[styles.card, !svc.active && styles.cardMuted]}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle} numberOfLines={2}>{svc.title_ru}</Text>
                <View style={styles.cardActions}>
                  <Pressable hitSlop={8} onPress={() => setEditing(svc)}>
                    <Ionicons name="create-outline" size={19} color="#64748B" />
                  </Pressable>
                  <Pressable hitSlop={8} onPress={() => remove(svc)}>
                    <Ionicons name="trash-outline" size={19} color="#EF4444" />
                  </Pressable>
                </View>
              </View>
              {!!svc.description_ru && <Text style={styles.cardSub} numberOfLines={3}>{svc.description_ru}</Text>}
              <View style={styles.cardMeta}>
                {svc.price_from != null && (
                  <Text style={styles.price}>{t('transport.from')} {svc.price_from} {svc.price_currency}</Text>
                )}
                {!!svc.duration && <Text style={styles.metaDim}>· {svc.duration}</Text>}
                {!svc.active && <Text style={styles.metaDim}>· {t('partner.serviceInactive')}</Text>}
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {editing && (
        <ServiceEditor
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); q.refetch(); onChange(); }}
        />
      )}
    </>
  );
}

function ServiceEditor({
  service, onClose, onSaved,
}: { service: PartnerService | null; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [form, setForm] = useState<PartnerServiceInput>({
    title: service?.title_ru || '',
    description: service?.description_ru || '',
    priceFrom: service?.price_from ?? null,
    priceCurrency: service?.price_currency || 'MNT',
    duration: service?.duration || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.title.trim() || saving) return;
    setSaving(true);
    try {
      const payload = { ...form, title: form.title.trim() };
      if (service) await api.updatePartnerService(service.id, payload);
      else await api.createPartnerService(payload);
      onSaved();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{service ? t('partner.editService') : t('partner.addService')}</Text>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>

          <Text style={styles.label}>{t('partner.serviceTitle')} *</Text>
          <TextInput
            style={styles.input}
            value={form.title}
            onChangeText={v => setForm(p => ({ ...p, title: v }))}
            placeholderTextColor="#94A3B8"
          />

          <Text style={styles.label}>{t('partner.description')}</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={form.description}
            onChangeText={v => setForm(p => ({ ...p, description: v }))}
            multiline
            placeholderTextColor="#94A3B8"
          />

          <View style={styles.priceRow}>
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>{t('partner.servicePrice')}</Text>
              <TextInput
                style={styles.input}
                value={form.priceFrom != null ? String(form.priceFrom) : ''}
                onChangeText={v => setForm(p => ({ ...p, priceFrom: v ? Number(v.replace(/[^\d]/g, '')) : null }))}
                keyboardType="number-pad"
                placeholderTextColor="#94A3B8"
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>{t('partner.serviceCurrency')}</Text>
              <TextInput
                style={styles.input}
                value={form.priceCurrency}
                onChangeText={v => setForm(p => ({ ...p, priceCurrency: v.toUpperCase().slice(0, 4) }))}
                autoCapitalize="characters"
                placeholderTextColor="#94A3B8"
              />
            </View>
          </View>

          <Text style={styles.label}>{t('partner.serviceDuration')}</Text>
          <TextInput
            style={styles.input}
            value={form.duration}
            onChangeText={v => setForm(p => ({ ...p, duration: v }))}
            placeholderTextColor="#94A3B8"
          />

          <Pressable
            style={[styles.primaryBtn, (!form.title.trim() || saving) && styles.submitBtnDisabled]}
            onPress={save}
            disabled={!form.title.trim() || saving}
          >
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('common.save')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/* ─────────────────────────── Orders (partner side) ─────────────────────────── */

function OrdersTab() {
  const { t } = useTranslation();
  const q = useQuery({ queryKey: ['partner-orders'], queryFn: () => api.getPartnerOrders() });
  const [noteFor, setNoteFor] = useState<Order | null>(null);

  const act = async (order: Order, status: OrderStatus) => {
    try {
      await api.updatePartnerOrder(order.id, { status });
      q.refetch();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    }
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={q.isRefetching} onRefresh={q.refetch} />}
      >
        {q.isLoading ? (
          <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
        ) : !q.data?.length ? (
          <Text style={styles.emptyNote}>{t('partner.noOrders')}</Text>
        ) : (
          q.data.map(o => (
            <View key={o.id} style={styles.card}>
              <View style={styles.cardRow}>
                <Text style={styles.cardTitle}>{t('partner.orderFrom')} {o.customer_name || '—'}</Text>
                <View style={[styles.statusPill, { backgroundColor: STATUS_COLOR[o.status] + '18' }]}>
                  <Text style={[styles.statusText, { color: STATUS_COLOR[o.status] }]}>
                    {t(`orders.status.${o.status}`)}
                  </Text>
                </View>
              </View>
              {!!o.customer_phone && <Text style={styles.cardSub}>{o.customer_phone}</Text>}
              {!!o.message && <Text style={styles.cardSub}>{o.message}</Text>}
              {o.price != null && <Text style={styles.price}>{o.price} {o.price_currency}</Text>}
              {!!o.partner_note && <Text style={styles.noteEcho}>{t('partner.noteLabel')}: {o.partner_note}</Text>}

              <View style={styles.orderActions}>
                {o.status === 'new' && (
                  <>
                    <Pressable style={[styles.actBtn, { backgroundColor: '#10B981' }]} onPress={() => act(o, 'accepted')}>
                      <Text style={styles.actBtnText}>{t('partner.accept')}</Text>
                    </Pressable>
                    <Pressable style={[styles.actBtn, { backgroundColor: '#EF4444' }]} onPress={() => act(o, 'declined')}>
                      <Text style={styles.actBtnText}>{t('partner.decline')}</Text>
                    </Pressable>
                  </>
                )}
                {o.status === 'accepted' && (
                  <Pressable style={[styles.actBtn, { backgroundColor: '#64748B' }]} onPress={() => act(o, 'completed')}>
                    <Text style={styles.actBtnText}>{t('partner.complete')}</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.actBtn, styles.actBtnGhost]} onPress={() => setNoteFor(o)}>
                  <Ionicons name="chatbubble-ellipses-outline" size={15} color={BRAND} />
                  <Text style={[styles.actBtnText, { color: BRAND }]}>{t('partner.noteLabel')}</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
        <View style={{ height: 32 }} />
      </ScrollView>

      {noteFor && (
        <NoteEditor
          order={noteFor}
          onClose={() => setNoteFor(null)}
          onSaved={() => { setNoteFor(null); q.refetch(); }}
        />
      )}
    </>
  );
}

function NoteEditor({ order, onClose, onSaved }: { order: Order; onClose: () => void; onSaved: () => void }) {
  const { t } = useTranslation();
  const [note, setNote] = useState(order.partner_note || '');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await api.updatePartnerOrder(order.id, { note });
      onSaved();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>{t('partner.noteLabel')}</Text>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={note}
            onChangeText={setNote}
            multiline
            autoFocus
            placeholder={t('partner.notePlaceholder')}
            placeholderTextColor="#94A3B8"
          />
          <Pressable style={[styles.primaryBtn, saving && styles.submitBtnDisabled]} onPress={save} disabled={saving}>
            {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryBtnText}>{t('partner.saveNote')}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 32, backgroundColor: '#F8FAFC' },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B', textAlign: 'center' },
  emptyNote: { fontSize: 14, color: '#94A3B8', textAlign: 'center', marginTop: 32 },

  headerCard: { backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  partnerName: { flex: 1, fontSize: 18, fontWeight: '800', color: '#1E293B' },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8, alignSelf: 'flex-start' },
  editLinkText: { fontSize: 13, fontWeight: '600', color: BRAND },

  statusPill: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '800' },

  tabs: { flexDirection: 'row', backgroundColor: '#fff', paddingHorizontal: 16, gap: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  tab: { paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabActive: { borderBottomColor: BRAND },
  tabText: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  tabTextActive: { color: BRAND },

  list: { padding: 16, gap: 12 },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1.5, borderColor: '#BFDBFE', borderStyle: 'dashed', paddingVertical: 13 },
  addBtnText: { fontSize: 14, fontWeight: '700', color: BRAND },

  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardMuted: { opacity: 0.55 },
  cardRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardActions: { flexDirection: 'row', gap: 14, paddingTop: 2 },
  cardSub: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: 2 },
  price: { fontSize: 13, fontWeight: '700', color: '#10B981' },
  metaDim: { fontSize: 12, color: '#94A3B8' },
  noteEcho: { fontSize: 12, color: '#475569', fontStyle: 'italic', marginTop: 4 },

  orderActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  actBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  actBtnGhost: { backgroundColor: '#EFF6FF' },
  actBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },

  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 12 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  inputMultiline: { minHeight: 84, textAlignVertical: 'top' },
  priceRow: { flexDirection: 'row', gap: 10 },

  primaryBtn: { flexDirection: 'row', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
});
