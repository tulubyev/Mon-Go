import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';
import { ApiError } from '@/services/api';

const BRAND = '#015197';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!email.trim() || !password) return;
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.back();
    } catch (err: any) {
      // Correct password, unverified email — send them to finish that
      // instead of leaving them at a dead-end error with no next step.
      if (err instanceof ApiError && err.data?.requiresVerification) {
        router.replace({ pathname: '/(auth)/verify' as any, params: { email: err.data.email || email.trim().toLowerCase() } });
        return;
      }
      setError(err.message || t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <View style={styles.iconWrap}>
          <Ionicons name="log-in-outline" size={40} color={BRAND} />
        </View>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.loginSub')}</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

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

          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={password}
              onChangeText={text => { setPassword(text); setError(''); }}
              secureTextEntry={!showPassword}
              textContentType="password"
              placeholder={t('auth.password')}
              placeholderTextColor="#94A3B8"
            />
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
            </Pressable>
          </View>

          <Pressable
            style={[styles.submitBtn, (!email.trim() || !password || submitting) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!email.trim() || !password || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.login')}</Text>}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.noAccount')}</Text>
          <Pressable onPress={() => router.replace('/(auth)/register' as any)}>
            <Text style={styles.footerLink}> {t('auth.registerLink')}</Text>
          </Pressable>
        </View>
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

  submitBtn: {
    height: 52, backgroundColor: BRAND, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 4,
    elevation: 2, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  submitBtnDisabled: { backgroundColor: '#94A3B8', shadowOpacity: 0, elevation: 0 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 28 },
  footerText: { fontSize: 14, color: '#64748B' },
  footerLink: { fontSize: 14, color: BRAND, fontWeight: '700' },
});
