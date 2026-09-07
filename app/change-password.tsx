import { useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, Pressable, ActivityIndicator,
  KeyboardAvoidingView, Platform, ScrollView, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { readingContainerStyle } from '@/constants/Layout';

export default function ChangePasswordScreen() {
  const { t } = useTranslation();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = currentPassword.length > 0 && newPassword.length >= 6 && newPassword === confirmPassword;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      Alert.alert('', t('auth.passwordChanged'));
      router.back();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('auth.passwordChangeError'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[styles.body, readingContainerStyle]} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>{t('auth.currentPassword')}</Text>
        <TextInput
          style={styles.input}
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          textContentType="password"
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
        />

        <Text style={styles.label}>{t('auth.newPassword')}</Text>
        <TextInput
          style={styles.input}
          value={newPassword}
          onChangeText={setNewPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
        />
        <Text style={styles.hint}>{t('auth.passwordHint')}</Text>

        <Text style={styles.label}>{t('auth.confirmPassword')}</Text>
        <TextInput
          style={[styles.input, confirmPassword.length > 0 && newPassword !== confirmPassword && styles.inputError]}
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          textContentType="newPassword"
          placeholder="••••••••"
          placeholderTextColor="#94A3B8"
        />
        {confirmPassword.length > 0 && newPassword !== confirmPassword && (
          <Text style={styles.errorHint}>{t('auth.passwordMismatch')}</Text>
        )}

        <Pressable
          style={[styles.submitBtn, (!canSubmit || submitting) && styles.submitBtnDisabled]}
          onPress={submit}
          disabled={!canSubmit || submitting}
        >
          {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{t('auth.save')}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  body: { padding: 24, paddingTop: 24 },
  label: { fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6, marginTop: 14 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B' },
  inputError: { borderColor: '#EF4444' },
  hint: { fontSize: 12, color: '#94A3B8', marginTop: 4 },
  errorHint: { fontSize: 12, color: '#EF4444', marginTop: 4 },
  submitBtn: { backgroundColor: '#015197', borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 28 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
