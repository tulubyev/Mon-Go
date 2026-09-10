import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, type PartnerApplyInput } from '@/services/api';
import { readingContainerStyle } from '@/constants/Layout';

const BRAND = '#015197';

// Editable subset of the partner profile — matches PUT /api/partner/me's
// whitelist (name/phone/email/url/telegram/whatsapp/address + description).
type EditKey = 'name' | 'phone' | 'email' | 'url' | 'telegram' | 'whatsapp' | 'address' | 'description';
const FIELDS: { key: EditKey; kb?: 'email-address' | 'phone-pad' | 'url'; multiline?: boolean }[] = [
  { key: 'name' },
  { key: 'phone', kb: 'phone-pad' },
  { key: 'email', kb: 'email-address' },
  { key: 'url', kb: 'url' },
  { key: 'telegram' },
  { key: 'whatsapp', kb: 'phone-pad' },
  { key: 'address' },
  { key: 'description', multiline: true },
];

export default function PartnerProfileScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const meQ = useQuery({ queryKey: ['partner-me'], queryFn: () => api.getPartnerMe() });
  const [form, setForm] = useState<Partial<Record<EditKey, string>>>({});
  const [saving, setSaving] = useState(false);

  if (meQ.isLoading) {
    return <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>;
  }
  const partner = meQ.data;
  if (!partner) { router.replace('/partner-apply' as any); return null; }

  const value = (k: EditKey): string => {
    if (form[k] !== undefined) return form[k]!;
    if (k === 'description') return partner.description_ru || '';
    return (partner[k] as string | null) || '';
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const payload: Partial<PartnerApplyInput> = {};
      for (const { key } of FIELDS) if (form[key] !== undefined) (payload as any)[key] = form[key];
      await api.updatePartnerMe(payload);
      await qc.invalidateQueries({ queryKey: ['partner-me'] });
      Alert.alert('', t('common.save'));
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        {FIELDS.map(({ key, kb, multiline }) => (
          <View key={key}>
            <Text style={styles.label}>{t(`partner.${key}`)}{key === 'name' ? ' *' : ''}</Text>
            <TextInput
              style={[styles.input, multiline && styles.inputMultiline]}
              value={value(key)}
              onChangeText={v => setForm(p => ({ ...p, [key]: v }))}
              keyboardType={kb || 'default'}
              autoCapitalize={kb === 'email-address' || kb === 'url' ? 'none' : 'sentences'}
              multiline={multiline}
              placeholderTextColor="#94A3B8"
            />
          </View>
        ))}

        <Pressable
          style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
          onPress={save}
          disabled={saving}
        >
          {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('partner.saveProfile')}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  inputMultiline: { minHeight: 90, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
