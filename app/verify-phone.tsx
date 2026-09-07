import { useRef, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

const CODE_LENGTH = 6;

export default function VerifyPhoneScreen() {
  const { t } = useTranslation();
  const { refreshUser } = useAuth();
  const [step, setStep] = useState<'phone' | 'code'>('phone');
  const [phone, setPhone] = useState('');
  const [digits, setDigits] = useState<string[]>(Array(CODE_LENGTH).fill(''));
  const [submitting, setSubmitting] = useState(false);
  const inputs = useRef<(TextInput | null)[]>([]);

  const code = digits.join('');

  const sendCode = async () => {
    if (!phone.trim()) return;
    setSubmitting(true);
    try {
      await api.sendCode(phone.trim(), 'phone');
      setStep('code');
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  const onChangeDigit = (text: string, index: number) => {
    const clean = text.replace(/\D/g, '');
    if (clean.length > 1) {
      const next = [...digits];
      for (let i = 0; i < clean.length && index + i < CODE_LENGTH; i++) next[index + i] = clean[i];
      setDigits(next);
      inputs.current[Math.min(index + clean.length, CODE_LENGTH - 1)]?.focus();
      return;
    }
    const next = [...digits];
    next[index] = clean;
    setDigits(next);
    if (clean && index < CODE_LENGTH - 1) inputs.current[index + 1]?.focus();
  };

  const onKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !digits[index] && index > 0) inputs.current[index - 1]?.focus();
  };

  const submitCode = async () => {
    if (code.length !== CODE_LENGTH) return;
    setSubmitting(true);
    try {
      await api.verifyCode(phone.trim(), code, 'phone');
      await refreshUser();
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.verifyError'));
    } finally {
      setSubmitting(false);
    }
  };

  if (step === 'phone') {
    return (
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
          <Text style={styles.emoji}>📱</Text>
          <Text style={styles.title}>{t('auth.verifyPhoneTitle')}</Text>
          <Text style={styles.subtitle}>{t('auth.verifyPhoneSubtitle')}</Text>

          <Text style={styles.label}>{t('auth.phone')}</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            textContentType="telephoneNumber"
            placeholder="+976 9911 2233"
            placeholderTextColor="#94A3B8"
          />

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
    <View style={styles.container}>
      <Text style={styles.emoji}>✉️</Text>
      <Text style={styles.title}>{t('auth.verifyTitle')}</Text>
      <Text style={styles.subtitle}>{t('auth.verifySubtitle', { email: phone })}</Text>

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
        onPress={submitCode}
        disabled={code.length !== CODE_LENGTH || submitting}
      >
        {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.verify')}</Text>}
      </Pressable>

      <Pressable style={styles.resendLink} onPress={() => setStep('phone')}>
        <Text style={styles.resendText}>{t('auth.changeNumber')}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', padding: 24, paddingTop: 48, alignItems: 'center' },
  body: { padding: 24, paddingTop: 32 },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  submitBtn: { backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  codeRow: { flexDirection: 'row', gap: 8, marginBottom: 32 },
  digitBox: {
    width: 46, height: 56, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0',
    backgroundColor: '#F8FAFC', fontSize: 24, fontWeight: '700', color: '#0F172A',
  },
  digitBoxFilled: { borderColor: '#015197', backgroundColor: '#EFF6FF' },
  resendLink: { marginTop: 20 },
  resendText: { color: '#015197', fontSize: 14, fontWeight: '600' },
});
