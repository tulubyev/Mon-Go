import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import { readingContainerStyle } from '@/constants/Layout';

export default function LoginScreen() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!email.trim() || !password) return;
    setSubmitting(true);
    try {
      await login(email.trim().toLowerCase(), password);
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.loginError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <Text style={styles.emoji}>🇲🇳</Text>
        <Text style={styles.title}>{t('auth.loginTitle')}</Text>

        <Text style={styles.label}>{t('auth.email')}</Text>
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

        <Text style={styles.label}>{t('auth.password')}</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
        />

        <Pressable
          style={[styles.submitBtn, (!email.trim() || !password || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!email.trim() || !password || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.login')}</Text>}
        </Pressable>

        <Pressable style={styles.switchLink} onPress={() => router.replace('/(auth)/register' as any)}>
          <Text style={styles.switchText}>{t('auth.noAccount')} {t('auth.registerLink')}</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 40 },
  emoji: { fontSize: 40, textAlign: 'center', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 28 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  submitBtn: { backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  switchLink: { marginTop: 20, alignItems: 'center' },
  switchText: { color: '#015197', fontSize: 14, fontWeight: '600' },
});
