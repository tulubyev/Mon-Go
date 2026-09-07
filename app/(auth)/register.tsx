import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

export default function RegisterScreen() {
  const { t } = useTranslation();
  const { register } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = firstName.trim().length > 0 && email.trim().length > 0 && password.length >= 6;

  const submit = async () => {
    if (!canSubmit) return;
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
      Alert.alert(t('common.error'), err.message || t('auth.registerError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>{t('auth.registerTitle')}</Text>

        <Text style={styles.label}>{t('auth.firstName')} *</Text>
        <TextInput style={styles.input} value={firstName} onChangeText={setFirstName} placeholderTextColor="#94A3B8" />

        <Text style={styles.label}>{t('auth.lastName')}</Text>
        <TextInput style={styles.input} value={lastName} onChangeText={setLastName} placeholderTextColor="#94A3B8" />

        <Text style={styles.label}>{t('auth.email')} *</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>{t('auth.password')} *</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

        <Pressable
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.register')}</Text>}
        </Pressable>

        <Pressable style={styles.switchLink} onPress={() => router.replace('/(auth)/login' as any)}>
          <Text style={styles.switchText}>{t('auth.hasAccount')} {t('auth.loginLink')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 32 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  submitBtn: { backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchLink: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#015197', fontSize: 14, fontWeight: '600' },
});
