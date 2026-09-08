import { useRef, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

const CODE_LENGTH = 6;
const BRAND = '#015197';

function maskPhone(phone: string): string {
  return phone.replace(/(\+?\d{1,3})(\d*)(\d{2})$/, '$1****$3');
}

export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const hiddenInput = useRef<TextInput>(null);
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const code = digits.join('');
  const filledCount = digits.filter(Boolean).length;

  const sendCode = async () => {
    if (!phone.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await api.sendCode(phone.trim(), 'phone');
      setStep('code');
      setTimeout(() => hiddenInput.current?.focus(), 300);
    } catch (err: any) {
      setError(err.message || t('auth.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitCode = async (fullCode: string) => {
    if (fullCode.length !== CODE_LENGTH) return;
    setError('');
    setSubmitting(true);
    try {
      await api.verifyCode(phone.trim(), fullCode, 'phone');
      await refreshUser();
      router.back();
    } catch (err: any) {
      setError(err.message || t('auth.verifyError'));
      setDigits(Array(CODE_LENGTH).fill(''));
      hiddenInput.current?.clear();
      hiddenInput.current?.focus();
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeCode = (text: string) => {
    const clean = text.replace(/\D/g, '').slice(0, CODE_LENGTH);
    const arr = clean.split('').concat(Array(CODE_LENGTH).fill('')).slice(0, CODE_LENGTH);
    setDigits(arr);
    setError('');
    if (clean.length === CODE_LENGTH) submitCode(clean);
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
          <View style={styles.iconWrap}>
            <Ionicons name="phone-portrait-outline" size={40} color={BRAND} />
          </View>
          <Text style={styles.title}>{t('auth.verifyPhoneTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.verifyPhoneSubtitle')}</Text>

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={16} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={phone}
              onChangeText={text => { setPhone(text); setError(''); }}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              placeholder="+976 9911 2233"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <Pressable
            style={[styles.submitBtn, (!phone.trim() || submitting) && styles.submitBtnDisabled]}
            onPress={sendCode}
            disabled={!phone.trim() || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.sendCode')}</Text>}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <TextInput
        ref={hiddenInput}
        style={styles.hiddenInput}
        value={code}
        onChangeText={onChangeCode}
        keyboardType="number-pad"
        maxLength={CODE_LENGTH}
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        importantForAutofill="yes"
        caretHidden
      />

      <View style={styles.iconWrap}>
        <Ionicons name="chatbox-ellipses-outline" size={40} color={BRAND} />
      </View>
      <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
      <Text style={styles.subtitle}>
        {t('auth.verifySubtitlePrefix')}{'\n'}
        <Text style={styles.identifier}>{maskPhone(phone)}</Text>
      </Text>

      {!!error && (
        <View style={styles.errorBox}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <Pressable onPress={() => hiddenInput.current?.focus()}>
        <View style={styles.codeRow} pointerEvents="none">
          {digits.map((d, i) => (
            <View key={i} style={[styles.codeCell, !!d && styles.codeCellFilled, i === filledCount && !submitting && styles.codeCellActive]}>
              <Text style={styles.codeCellText}>{d}</Text>
            </View>
          ))}
        </View>
      </Pressable>

      {submitting && <ActivityIndicator color={BRAND} style={{ marginBottom: 12 }} />}

      <Pressable style={styles.resendLink} onPress={() => setStep('phone')}>
        <Text style={styles.resendText}>{t('auth.changeNumber')}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, backgroundColor: '#fff', padding: 24, paddingTop: 40, alignItems: 'center' },
  body: { padding: 24, paddingTop: 32 },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },

  iconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 20, lineHeight: 21 },
  identifier: { fontWeight: '700', color: '#1E293B' },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, gap: 8, marginBottom: 16, width: '100%' },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, height: 52, marginBottom: 16 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1E293B' },

  submitBtn: {
    height: 52, backgroundColor: BRAND, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  codeCell: { width: 46, height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  codeCellFilled: { borderColor: BRAND, backgroundColor: '#EFF6FF' },
  codeCellActive: { borderColor: '#3B82F6' },
  codeCellText: { fontSize: 22, fontWeight: '800', color: '#1E293B' },

  resendLink: { marginTop: 20 },
  resendText: { color: BRAND, fontSize: 14, fontWeight: '600' },
});
