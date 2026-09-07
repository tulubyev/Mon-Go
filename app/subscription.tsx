import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator,
  Modal, Alert, Platform, Linking,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { api, type SubscriptionPlan } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

type FlowState = 'idle' | 'processing' | 'waiting';

const PLAN_COLORS: Record<string, string> = { basic: '#0EA5E9', premium: '#7C3AED', b2b: '#D97706' };

export default function SubscriptionScreen() {
  const { t } = useTranslation();
  const { user, refreshUser } = useAuth();
  const { data: plans, isLoading } = useQuery({
    queryKey: ['subscription-plans'],
    queryFn: () => api.getSubscriptionPlans(),
    staleTime: 60 * 60_000, // plans barely change — an hour is plenty
  });

  const [flow, setFlow] = useState<FlowState>('idle');
  const [paymentUrl, setPaymentUrl] = useState<string | null>(null);
  const paymentIdRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const stopPolling = () => {
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
  };

  const checkStatus = async (final: boolean) => {
    if (!paymentIdRef.current) return;
    try {
      const { status } = await api.getPaymentStatus(paymentIdRef.current);
      if (status === 'succeeded') {
        stopPolling();
        setFlow('idle');
        setPaymentUrl(null);
        await refreshUser();
        Alert.alert('', t('subscription.success'));
      } else if (status === 'canceled') {
        stopPolling();
        setFlow('idle');
        setPaymentUrl(null);
        if (final) Alert.alert('', t('subscription.canceled'));
      }
    } catch {
      // transient network blip — the next poll tick (or the final check) retries
    }
  };

  const subscribe = async (plan: SubscriptionPlan) => {
    setFlow('processing');
    try {
      const { confirmationUrl, paymentId } = await api.createPayment(plan.id);
      paymentIdRef.current = paymentId;
      if (Platform.OS === 'web') {
        Linking.openURL(confirmationUrl);
      }
      setPaymentUrl(confirmationUrl);
      setFlow('waiting');
      pollRef.current = setInterval(() => checkStatus(false), 3000);
    } catch (err: any) {
      setFlow('idle');
      Alert.alert(t('common.error'), err.message || t('subscription.error'));
    }
  };

  const confirmSubscribe = (plan: SubscriptionPlan) => {
    Alert.alert(
      plan.nameRu,
      t('subscription.confirmMsg', { price: plan.priceRub }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('subscription.pay'), onPress: () => subscribe(plan) },
      ]
    );
  };

  const cancelSubscription = () => {
    Alert.alert(t('subscription.cancelTitle'), t('subscription.cancelMsg'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await api.cancelSubscription();
            await refreshUser();
          } catch (err: any) {
            Alert.alert(t('common.error'), err.message || t('subscription.error'));
          }
        },
      },
    ]);
  };

  const closeModal = () => {
    stopPolling();
    setFlow('idle');
    setPaymentUrl(null);
    // The user may have already finished paying and just closed the sheet —
    // do one last check instead of silently dropping a successful payment.
    checkStatus(true);
  };

  const currentTier = user?.subscriptionTier && user.subscriptionTier !== 'free' ? user.subscriptionTier : null;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]}>
        {currentTier && (
          <View style={styles.currentCard}>
            <Text style={styles.currentLabel}>{t('subscription.current')}</Text>
            <Text style={styles.currentTier}>{plans?.find(p => p.id === currentTier)?.nameRu || currentTier}</Text>
            {user?.subscriptionExpires && (
              <Text style={styles.currentExpires}>
                {t('subscription.until')} {new Date(user.subscriptionExpires).toLocaleDateString()}
              </Text>
            )}
            <Pressable style={styles.cancelBtn} onPress={cancelSubscription}>
              <Text style={styles.cancelBtnText}>{t('subscription.cancel')}</Text>
            </Pressable>
          </View>
        )}

        {isLoading ? (
          <ActivityIndicator style={{ marginTop: 40 }} size="large" color="#015197" />
        ) : (
          plans?.map(plan => {
            const color = PLAN_COLORS[plan.id] || '#015197';
            const isCurrent = currentTier === plan.id;
            return (
              <View key={plan.id} style={[styles.planCard, { borderColor: color + '40' }]}>
                <View style={[styles.planBadge, { backgroundColor: color }]}>
                  <Text style={styles.planBadgeText}>{plan.nameRu}</Text>
                </View>
                <Text style={styles.planPrice}>{plan.priceRub} ₽<Text style={styles.planPricePeriod}>/{t('subscription.month')}</Text></Text>
                {plan.features.map((f, i) => (
                  <View key={i} style={styles.featureRow}>
                    <Text style={styles.featureCheck}>✓</Text>
                    <Text style={styles.featureText}>{f}</Text>
                  </View>
                ))}
                <Pressable
                  style={[styles.subscribeBtn, { backgroundColor: isCurrent ? '#E2E8F0' : color }]}
                  onPress={() => !isCurrent && confirmSubscribe(plan)}
                  disabled={isCurrent || flow !== 'idle'}
                >
                  <Text style={[styles.subscribeBtnText, isCurrent && styles.subscribeBtnTextCurrent]}>
                    {isCurrent ? t('subscription.active') : t('subscription.subscribe')}
                  </Text>
                </Pressable>
              </View>
            );
          })
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {flow === 'processing' && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#fff" />
        </View>
      )}

      <Modal visible={flow === 'waiting' && !!paymentUrl} animationType="slide" presentationStyle="pageSheet" onRequestClose={closeModal}>
        <View style={styles.modalHeader}>
          <Pressable onPress={closeModal} hitSlop={8}>
            <Text style={styles.modalClose}>✕ {t('common.close')}</Text>
          </Pressable>
        </View>
        {paymentUrl && (
          <WebView
            source={{ uri: paymentUrl }}
            onNavigationStateChange={nav => {
              // YooKassa redirects here once the payment flow resolves —
              // check immediately instead of waiting up to 3s for the next poll tick.
              if (nav.url.includes('payment-return') || nav.url.includes('mon-go.ru')) {
                checkStatus(false);
              }
            }}
          />
        )}
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  body: { padding: 16 },

  currentCard: { backgroundColor: '#fff', borderRadius: 16, padding: 18, marginBottom: 16, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  currentLabel: { fontSize: 12, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' },
  currentTier: { fontSize: 20, fontWeight: '800', color: '#0F172A', marginTop: 4 },
  currentExpires: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  cancelBtn: { marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: '#FEE2E2' },
  cancelBtnText: { color: '#B91C1C', fontSize: 13, fontWeight: '700' },

  planCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1.5, padding: 18, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 1 },
  planBadge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 10 },
  planBadgeText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  planPrice: { fontSize: 28, fontWeight: '800', color: '#0F172A', marginBottom: 12 },
  planPricePeriod: { fontSize: 14, fontWeight: '600', color: '#94A3B8' },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 },
  featureCheck: { color: '#10B981', fontWeight: '800', fontSize: 14 },
  featureText: { flex: 1, fontSize: 14, color: '#334155' },
  subscribeBtn: { marginTop: 12, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  subscribeBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  subscribeBtnTextCurrent: { color: '#94A3B8' },

  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'flex-end', padding: 12, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  modalClose: { fontSize: 15, color: '#475569', fontWeight: '600' },
});
