import { StyleSheet, Text, View, Pressable } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'en' as const, flag: '🇬🇧', nativeName: 'English' },
  { code: 'zh' as const, flag: '🇨🇳', nativeName: '中文' },
  { code: 'mn' as const, flag: '🇲🇳', nativeName: 'Монгол' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());
  const { user, isAuthenticated, isLoading, logout } = useAuth();

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      {/* Account — minimal guest/profile split; full profile (avatar, verification,
          subscription) is a separate build, this just makes auth reachable. */}
      {!isLoading && (
        <View style={styles.section}>
          {isAuthenticated && user ? (
            <View style={styles.accountRow}>
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(user.firstName || user.email)[0].toUpperCase()}</Text>
              </View>
              <View style={styles.accountInfo}>
                <Text style={styles.accountName}>{user.firstName} {user.lastName || ''}</Text>
                <Text style={styles.accountEmail}>{user.email}</Text>
              </View>
              <Pressable style={styles.logoutBtn} onPress={logout}>
                <Text style={styles.logoutBtnText}>{t('common.logout')}</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.guestRow}>
              <Pressable style={styles.authBtn} onPress={() => router.push('/(auth)/login' as any)}>
                <Text style={styles.authBtnText}>{t('auth.login')}</Text>
              </Pressable>
              <Pressable style={[styles.authBtn, styles.authBtnOutline]} onPress={() => router.push('/(auth)/register' as any)}>
                <Text style={[styles.authBtnText, styles.authBtnTextOutline]}>{t('auth.register')}</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('settings.language')}</Text>
        <View style={styles.langList}>
          {LANGUAGES.map(lang => (
            <Pressable
              key={lang.code}
              style={[styles.langItem, current === lang.code && styles.langItemActive]}
              onPress={() => handleLanguage(lang.code)}
            >
              <Text style={styles.langFlag}>{lang.flag}</Text>
              <Text style={[styles.langName, current === lang.code && styles.langNameActive]}>
                {lang.nativeName}
              </Text>
              {current === lang.code && <Text style={styles.checkmark}>✓</Text>}
            </Pressable>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  section: { margin: 12, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  langList: {},
  langItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 12 },
  langItemActive: { backgroundColor: '#f0f7ff' },
  langFlag: { fontSize: 22 },
  langName: { fontSize: 16, color: '#333', flex: 1 },
  langNameActive: { color: '#3b82f6', fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#3b82f6', fontWeight: '700' },

  accountRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatarPlaceholder: { width: 44, height: 44, borderRadius: 22, backgroundColor: '#015197', alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontSize: 18, fontWeight: '700' },
  accountInfo: { flex: 1 },
  accountName: { fontSize: 15, fontWeight: '700', color: '#1a1a1a' },
  accountEmail: { fontSize: 12, color: '#888', marginTop: 2 },
  logoutBtn: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#fee2e2' },
  logoutBtnText: { fontSize: 13, fontWeight: '600', color: '#b91c1c' },
  guestRow: { flexDirection: 'row', gap: 10, padding: 14 },
  authBtn: { flex: 1, backgroundColor: '#015197', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  authBtnOutline: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#015197' },
  authBtnText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  authBtnTextOutline: { color: '#015197' },
});
