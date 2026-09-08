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

const BRAND = '#015197';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = firstName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
    setError('');
    setSubmitting(true);
    try {
      const result = await register({
        email: email.trim().toLowerCase(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim() || undefined,
      });
      router.replace({ pathname: '/(auth)/verify' as any, params: { email: result.email } });
    } catch (err: any) {
      setError(err.message || t('auth.registerError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>
        <Text style={styles.subtitle}>{t('auth.registerSub')}</Text>

        {!!error && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle" size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <View style={styles.form}>
          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={text => { setFirstName(text); setError(''); }}
              placeholder={t('auth.firstName')}
              placeholderTextColor="#94A3B8"
              autoCorrect={false}
            />
          </View>

          <View style={styles.inputWrap}>
            <Ionicons name="person-outline" size={18} color="#94A3B8" style={styles.inputIcon} />
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('auth.lastName')}
              placeholderTextColor="#94A3B8"
              autoCorrect={false}
            />
          </View>

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
              textContentType="newPassword"
              placeholder={t('auth.password')}
              placeholderTextColor="#94A3B8"
            />
            <Pressable onPress={() => setShowPassword(v => !v)} style={styles.eyeBtn} hitSlop={8}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={18} color="#94A3B8" />
            </Pressable>
          </View>
          <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

          <Pressable
            style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!canSubmit || submitting}
          >
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.register')}</Text>}
          </Pressable>
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>{t('auth.hasAccount')}</Text>
          <Pressable onPress={() => router.replace('/(auth)/login' as any)}>
            <Text style={styles.footerLink}> {t('auth.loginLink')}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 32 },
  title: { fontSize: 24, fontWeight: '800', color: '#1E293B', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#64748B', textAlign: 'center', marginTop: 4, marginBottom: 20 },

  errorBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF2F2', borderRadius: 10, padding: 12, gap: 8, marginBottom: 16 },
  errorText: { color: '#EF4444', fontSize: 13, flex: 1 },

  form: { gap: 12 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 14, height: 52 },
  inputIcon: { marginRight: 8 },
  input: { flex: 1, fontSize: 15, color: '#1E293B' },
  eyeBtn: { padding: 4 },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: -4, paddingHorizontal: 4 },

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
