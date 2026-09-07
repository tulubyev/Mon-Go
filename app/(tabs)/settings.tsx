import { StyleSheet, Text, View, Pressable, Image, ActivityIndicator, Alert } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'en' as const, flag: '🇬🇧', nativeName: 'English' },
  { code: 'zh' as const, flag: '🇨🇳', nativeName: '中文' },
  { code: 'mn' as const, flag: '🇲🇳', nativeName: 'Монгол' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());
  const { user, isAuthenticated, isLoading, logout, refreshUser } = useAuth();

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

      {!isLoading && (
        isAuthenticated && user
          ? <ProfileSection user={user} onLogout={logout} onRefresh={refreshUser} />
          : <GuestSection />
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

function GuestSection() {
  const { t } = useTranslation();
  return (
    <View style={styles.section}>
      <View style={styles.guestRow}>
        <Pressable style={styles.authBtn} onPress={() => router.push('/(auth)/login' as any)}>
          <Text style={styles.authBtnText}>{t('auth.login')}</Text>
        </Pressable>
        <Pressable style={[styles.authBtn, styles.authBtnOutline]} onPress={() => router.push('/(auth)/register' as any)}>
          <Text style={[styles.authBtnText, styles.authBtnTextOutline]}>{t('auth.register')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ProfileSection({ user, onLogout, onRefresh }: {
  user: NonNullable<ReturnType<typeof useAuth>['user']>;
  onLogout: () => void;
  onRefresh: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const [uploading, setUploading] = useState(false);

  const pickAvatar = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(t('common.error'), t('ocr.noAccess'));
      return;
    }
    // allowsEditing gives a native square-crop UI on both platforms — no
    // need to hand-roll a pan/zoom cropper for this.
    const result = await ImagePicker.launchImageLibraryAsync({
      base64: true,
      quality: 0.6,
      allowsEditing: true,
      aspect: [1, 1],
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
    });
    if (result.canceled || !result.assets[0]?.base64) return;

    const asset = result.assets[0];
    const mime = asset.mimeType && asset.mimeType.startsWith('image/') ? asset.mimeType : 'image/jpeg';
    setUploading(true);
    try {
      await api.updateAvatar(`data:${mime};base64,${asset.base64}`);
      await onRefresh();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  const notReady = () => Alert.alert('', t('auth.comingSoon'));

  return (
    <>
      <View style={styles.section}>
        <View style={styles.accountRow}>
          <Pressable onPress={pickAvatar} disabled={uploading} style={styles.avatarWrap}>
            {uploading ? (
              <View style={styles.avatarPlaceholder}><ActivityIndicator color="#fff" size="small" /></View>
            ) : user.avatarUrl ? (
              <Image source={{ uri: user.avatarUrl }} style={styles.avatarImage} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarInitial}>{(user.firstName || user.email)[0].toUpperCase()}</Text>
              </View>
            )}
            <View style={styles.avatarEditBadge}><Text style={styles.avatarEditIcon}>✎</Text></View>
          </Pressable>
          <View style={styles.accountInfo}>
            <Text style={styles.accountName}>{user.firstName} {user.lastName || ''}</Text>
            <Text style={styles.accountEmail}>{user.email}</Text>
          </View>
          <Pressable style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>{t('common.logout')}</Text>
          </Pressable>
        </View>

        {!user.emailVerified && (
          <Pressable
            style={styles.verifyBanner}
            onPress={() => router.push({ pathname: '/(auth)/verify' as any, params: { email: user.email } })}
          >
            <Text style={styles.verifyBannerText}>⚠️ {t('auth.emailNotVerified')}</Text>
            <Text style={styles.verifyBannerArrow}>›</Text>
          </Pressable>
        )}
        {!user.phoneVerified && (
          <Pressable style={styles.verifyBanner} onPress={() => router.push('/verify-phone' as any)}>
            <Text style={styles.verifyBannerText}>📱 {t('auth.phoneNotVerified')}</Text>
            <Text style={styles.verifyBannerArrow}>›</Text>
          </Pressable>
        )}
      </View>

      <View style={styles.section}>
        <MenuRow label={t('auth.changePassword')} icon="🔒" onPress={() => router.push('/change-password' as any)} />
        <MenuRow label={t('auth.subscription')} icon="⭐" onPress={() => router.push('/subscription' as any)} />
        <MenuRow label={t('auth.favorites')} icon="📍" onPress={notReady} last />
      </View>
    </>
  );
}

function MenuRow({ label, icon, onPress, last }: { label: string; icon: string; onPress: () => void; last?: boolean }) {
  return (
    <Pressable style={[styles.menuRow, !last && styles.menuRowBorder]} onPress={onPress}>
      <Text style={styles.menuIcon}>{icon}</Text>
      <Text style={styles.menuLabel}>{label}</Text>
      <Text style={styles.menuArrow}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  section: { margin: 12, marginBottom: 0, backgroundColor: '#fff', borderRadius: 12, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 8 },
  langList: {},
  langItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#f0f0f0', gap: 12 },
  langItemActive: { backgroundColor: '#f0f7ff' },
  langFlag: { fontSize: 22 },
  langName: { fontSize: 16, color: '#333', flex: 1 },
  langNameActive: { color: '#3b82f6', fontWeight: '600' },
  checkmark: { fontSize: 16, color: '#3b82f6', fontWeight: '700' },

  accountRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  avatarWrap: { position: 'relative' },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#015197', alignItems: 'center', justifyContent: 'center' },
  avatarImage: { width: 52, height: 52, borderRadius: 26 },
  avatarInitial: { color: '#fff', fontSize: 20, fontWeight: '700' },
  avatarEditBadge: { position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: 10, backgroundColor: '#015197', borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  avatarEditIcon: { fontSize: 10, color: '#fff' },
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

  verifyBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#fde68a' },
  verifyBannerText: { flex: 1, fontSize: 13, color: '#92400e', fontWeight: '600' },
  verifyBannerArrow: { fontSize: 18, color: '#92400e' },

  menuRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  menuRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  menuIcon: { fontSize: 18 },
  menuLabel: { flex: 1, fontSize: 15, color: '#333' },
  menuArrow: { fontSize: 18, color: '#ccc' },
});
