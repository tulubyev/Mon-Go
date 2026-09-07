import { useRef, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator, Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';

const CODE_LENGTH = 6;

export default function VerifyScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email: string }>();
  const { verifyCode, sendCode } = useAuth();
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');

  const onChangeDigit = (text: string, index: number) => {
    // Handles a full code pasted into one box, not just single-digit typing.
    const clean = text.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) next[index + i] = clean[i];
      setDigits(next);
      const lastFilled = Math.min(index + clean.length, CODE_LENGTH - 1);
      inputs.current[lastFilled]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const submit = async () => {
    if (code.length !== CODE_LENGTH || !email) return;
    setSubmitting(true);
    try {
      await verifyCode(email, code);
      router.dismissAll();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const resend = async () => {
    if (!email) return;
    setResending(true);
    try {
      await sendCode(email);
      Alert.alert('', t('auth.codeResent'));
    } catch {
      Alert.alert(t('common.error'), t('auth.verifyError'));
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>✉️</Text>
      <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
      <Text style={styles.subtitle}>{t('auth.verifySubtitle', { email })}</Text>

      <View style={styles.codeRow}>
        {digits.map((d, i) => (
          <TextInput
            key={i}
            ref={r => { inputs.current[i] = r; }}
            style={[styles.digitBox, d && styles.digitBoxFilled]}
            value={d}
            onChangeText={text => onChangeDigit(text, i)}
            onKeyPress={e => onKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={CODE_LENGTH}
            textAlign="center"
          />
        ))}
      </View>

      <Pressable
        style={[styles.submitBtn, (code.length !== CODE_LENGTH || submitting) && styles.submitBtnDisabled]}
        onPress={submit}
        disabled={code.length !== CODE_LENGTH || submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.verify')}</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={resend} disabled={resending}>
        {resending
          ? <ActivityIndicator size="small" color="#015197" />
          : <Text style={styles.resendText}>{t('auth.resendCode')}</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 48, alignItems: 'center' },
  emoji: { fontSize: 40, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 32 },
  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  digitBox: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', fontSize: 24, fontWeight: '700', color: '#0F172A',
  },
  digitBoxFilled: { borderColor: '#015197', backgroundColor: '#EFF6FF' },
  submitBtn: { backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, paddingHorizontal: 48, alignItems: 'center' },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  resendLink: { marginTop: 20 },
  resendText: { color: '#015197', fontSize: 14, fontWeight: '600' },
});
