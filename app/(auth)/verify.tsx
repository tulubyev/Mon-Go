import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

const CODE_LENGTH = 6;
const BRAND = '#015197';
const RESEND_COOLDOWN = 60;

function maskEmail(email: string): string {
  return email.replace(/(.{2})(.*)(@.*)/, '$1***$3');
}

export default function VerifyScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyCode, sendCode } = useAuth();

  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(RESEND_COOLDOWN);

  // Real, invisible input — this is what iOS QuickType / Android SMS
  // autofill actually targets (textContentType/autoComplete below); the
  // boxes underneath are a display-only reflection of its value.
  const hiddenInput = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => hiddenInput.current?.focus(), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const code = digits.join('');
  const filledCount = digits.filter(Boolean).length;

  const submit = async (fullCode: string) => {
    if (fullCode.length !== CODE_LENGTH || !email) return;
    setError('');
    setSubmitting(true);
    try {
      await verifyCode(email, fullCode);
      router.dismissAll();
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
    if (clean.length === CODE_LENGTH) submit(clean);
  };

  const resend = async () => {
    if (!email || countdown > 0) return;
    setResending(true);
    try {
      await sendCode(email);
      setCountdown(RESEND_COOLDOWN);
      setError('');
    } catch (err: any) {
      setError(err.message || t('auth.verifyError'));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        {/* Hidden real input — captures full OTP incl. iOS/Android autofill */}
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
          <Ionicons name="mail-open-outline" size={44} color={BRAND} />
        </View>

        <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
        <Text style={styles.subtitle}>
          {t('auth.verifySubtitlePrefix')}{'\n'}
          <Text style={styles.identifier}>{email ? maskEmail(email) : ''}</Text>
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
              <View
                key={i}
                style={[
                  styles.codeCell,
                  !!d && styles.codeCellFilled,
                  i === filledCount && !submitting && styles.codeCellActive,
                ]}
              >
                <Text style={styles.codeCellText}>{d}</Text>
              </View>
            ))}
          </View>
        </Pressable>

        {submitting && <ActivityIndicator color={BRAND} style={{ marginTop: 4, marginBottom: 12 }} />}

        <Pressable style={[styles.resendBtn, countdown > 0 && styles.resendBtnDisabled]} onPress={resend} disabled={countdown > 0 || resending}>
          {resending ? (
            <ActivityIndicator size="small" color={BRAND} />
          ) : (
            <Text style={[styles.resendText, countdown > 0 && styles.resendTextDisabled]}>
              {countdown > 0 ? t('auth.resendIn', { seconds: countdown }) : t('auth.resendCode')}
            </Text>
          )}
        </Pressable>

        <View style={styles.footerNote}>
          <Ionicons name="shield-checkmark-outline" size={14} color="#94A3B8" />
          <Text style={styles.footerNoteText}>{t('auth.codeValidFor')}</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  container: { flexGrow: 1, paddingHorizontal: 24, paddingTop: 40, alignItems: 'center' },

  iconWrap: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  title: { fontSize: 22, fontWeight: '800', color: '#1E293B', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
  identifier: { fontWeight: '700', color: '#1E293B' },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, gap: 8, marginBottom: 16, width: '100%' },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  codeCell: { width: 46, height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
  codeCellFilled: { borderColor: BRAND, backgroundColor: '#EFF6FF' },
  codeCellActive: { borderColor: '#3B82F6' },
  codeCellText: { fontSize: 22, fontWeight: '800', color: '#1E293B' },

  resendBtn: { marginTop: 16, paddingVertical: 12, paddingHorizontal: 24 },
  resendBtnDisabled: { opacity: 0.6 },
  resendText: { fontSize: 14, color: BRAND, fontWeight: '600' },
  resendTextDisabled: { color: '#94A3B8' },

  footerNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 'auto', paddingTop: 24, paddingBottom: 12 },
  footerNoteText: { fontSize: 12, color: '#94A3B8' },
});
