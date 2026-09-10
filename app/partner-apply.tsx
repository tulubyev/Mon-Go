import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { api, type PartnerApplyInput } from '@/services/api';
import { readingContainerStyle } from '@/constants/Layout';

const BRAND = '#015197';

// Same partner taxonomy the public directory filters by (partners.tsx TYPES).
const TYPES = ['tour_agency', 'guide', 'hotel', 'car_rental', 'visa'] as const;

export default function PartnerApplyScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [form, setForm] = useState<PartnerApplyInput>({ name: '', type: 'tour_agency' });
  const [submitting, setSubmitting] = useState(false);

  const set = <K extends keyof PartnerApplyInput>(k: K, v: PartnerApplyInput[K]) =>
    setForm(prev => ({ ...prev, [k]: v }));

  const canSubmit = form.name.trim().length >= 2;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      await api.partnerApply({ ...form, name: form.name.trim() });
      await qc.invalidateQueries({ queryKey: ['partner-me'] });
      Alert.alert('', t('partner.submitted'));
      router.replace('/partner-dashboard' as any);
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSubmitting(false);
    }
  };

  const field = (
    k: keyof PartnerApplyInput,
    label: string,
    opts: { keyboardType?: 'default' | 'email-address' | 'phone-pad' | 'url'; multiline?: boolean } = {},
  ) => (
    <>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, opts.multiline && styles.inputMultiline]}
        value={(form[k] as string) || ''}
        onChangeText={v => set(k, v as any)}
        keyboardType={opts.keyboardType || 'default'}
        autoCapitalize={opts.keyboardType === 'email-address' || opts.keyboardType === 'url' ? 'none' : 'sentences'}
        multiline={opts.multiline}
        placeholderTextColor="#94A3B8"
      />
    </>
  );

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <Text style={styles.intro}>{t('partner.applySub')}</Text>

        {field('name', t('partner.name') + ' *')}

        <Text style={styles.label}>{t('partner.type')}</Text>
        <View style={styles.typeRow}>
          {TYPES.map(ty => {
            const active = form.type === ty;
            return (
              <Pressable
                key={ty}
                style={[styles.typeChip, active && styles.typeChipActive]}
                onPress={() => set('type', ty)}
              >
                <Text style={[styles.typeChipText, active && styles.typeChipTextActive]}>
                  {t(`partners.types.${ty}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {field('phone', t('partner.phone'), { keyboardType: 'phone-pad' })}
        {field('email', t('partner.email'), { keyboardType: 'email-address' })}
        {field('url', t('partner.url'), { keyboardType: 'url' })}
        {field('telegram', t('partner.telegram'))}
        {field('whatsapp', t('partner.whatsapp'), { keyboardType: 'phone-pad' })}
        {field('address', t('partner.address'))}
        {field('description', t('partner.description'), { multiline: true })}

        <Pressable
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : (
            <>
              <Ionicons name="paper-plane" size={16} color="#fff" />
              <Text style={styles.submitText}>{t('partner.submit')}</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 20 },
  intro: { fontSize: 14, color: '#64748B', lineHeight: 20, marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 2 },
  typeChip: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  typeChipTextActive: { color: '#fff' },
  submitBtn: { flexDirection: 'row', gap: 8, backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
