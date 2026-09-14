import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

const BRAND = '#015197';

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { forgotPassword, resetPassword } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();

  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const sendCode = async () => {
    if (!email.trim()) return;
    setError('');
    setSubmitting(true);
    try {
      await forgotPassword(email.trim().toLowerCase());
      setStep('reset');
    } catch (err: any) {
      setError(err.message || t('auth.resetPasswordError'));
    } finally {
      setSubmitting(false);
    }
  };

  const submitReset = async () => {
    if (code.trim().length < 4 || newPassword.length < 6) return;
    setError('');
    setSubmitting(true);
    try {
      await resetPassword(email.trim().toLowerCase(), code.trim(), newPassword);
      router.dismissAll();
    } catch (err: any) {
      setError(err.message || t('auth.resetPasswordError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: t('auth.forgotPasswordTitle'), headerBackTitle: t('common.back') }} />
      <ScrollView
        contentContainerStyle={[styles.body, readingContainerStyle, { paddingBottom: tabBarHeight + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={40} color={BRAND} />
        </View>
        <Text style={styles.title}>{t('auth.forgotPasswordTitle')}</Text>
        <Text style={styles.subtitle}>
          {step === 'email' ? t('auth.forgotPasswordSub') : t('auth.resetPasswordSub')}
        </Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {step === 'email' ? (
          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="mail-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={text => { setEmail(text); setError(''); }}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
                placeholder={t('auth.email')}
                placeholderTextColor="#94A3B8"
              />
            </View>

            <Pressable
              style={[styles.submitBtn, (!email.trim() || submitting) && styles.submitBtnDisabled]}
              onPress={sendCode}
              disabled={!email.trim() || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.sendCode')}</Text>}
            </Pressable>
          </View>
        ) : (
          <View style={styles.form}>
            <View style={styles.inputWrap}>
              <Ionicons name="keypad-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                value={code}
                onChangeText={text => { setCode(text.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                keyboardType="number-pad"
                placeholder="123456"
                placeholderTextColor="#94A3B8"
              />
            </View>

            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={newPassword}
                onChangeText={text => { setNewPassword(text); setError(''); }}
                secureTextEntry={!showPassword}
                textContentType="newPassword"
                placeholder={t('auth.newPassword')}
                placeholderTextColor="#94A3B8"
              />
              <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={8}>
                <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
              </Pressable>
            </View>
            <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

            <Pressable
              style={[styles.submitBtn, (code.trim().length < 4 || newPassword.length < 6 || submitting) && styles.submitBtnDisabled]}
              onPress={submitReset}
              disabled={code.trim().length < 4 || newPassword.length < 6 || submitting}
            >
              {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.resetPassword')}</Text>}
            </Pressable>

            <Pressable onPress={sendCode} disabled={submitting} hitSlop={8}>
              <Text style={styles.resendLink}>{t('auth.resendCode')}</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 32 },
  iconWrap: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 24 },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, gap: 8, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  form: { gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 14, paddingHorizontal: 16, height: 54 },
  inputIcon: { marginRight: 10 },
  input: { flex: 1, fontSize: 15, color: '#0F172A' },
  eyeBtn: { padding: 4 },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: -4, paddingHorizontal: 4 },

  submitBtn: {
    height: 52, backgroundColor: BRAND, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    elevation: 2, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  resendLink: { textAlign: 'center', fontSize: 13, color: BRAND, fontWeight: '600', marginTop: 8 },
});
