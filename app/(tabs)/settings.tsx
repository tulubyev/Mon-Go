import { StyleSheet, Text, View, Pressable, Image, ActivityIndicator, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/services/api';

const BRAND = '#015197';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'en' as const, flag: '🇬🇧', nativeName: 'English' },
  { code: 'zh' as const, flag: '🇨🇳', nativeName: '中文' },
  { code: 'mn' as const, flag: '🇲🇳', nativeName: 'Монгол' },
];

const GUEST_SERVICES: Array<{ icon: keyof typeof Ionicons.glyphMap; color: string }> = [
  { icon: 'map-outline', color: '#0EA5E9' },
  { icon: 'chatbubbles-outline', color: '#10B981' },
  { icon: 'book-outline', color: '#F59E0B' },
  { icon: 'people-outline', color: '#EF4444' },
  { icon: 'airplane-outline', color: '#8B5CF6' },
  { icon: 'restaurant-outline', color: '#EC4899' },
];

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { user, isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={BRAND} />
      </View>
    );
  }

  return isAuthenticated && user ? <ProfileScreen /> : <GuestScreen />;
}

function GuestScreen() {
  const { t } = useTranslation();
  const tabBarHeight = useBottomTabBarHeight();
  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={[styles.guestContainer, { paddingBottom: tabBarHeight + 24 }]}>
      <View style={styles.guestIcon}>
        <Ionicons name="person-outline" size={48} color="#94A3B8" />
      </View>
      <Text style={styles.guestTitle}>{t('auth.guestTitle')}</Text>

      <View style={styles.guestServices}>
        {GUEST_SERVICES.map(item => (
          <View key={item.icon} style={[styles.guestServiceIcon, { backgroundColor: item.color + '20' }]}>
            <Ionicons name={item.icon} size={26} color={item.color} />
          </View>
        ))}
      </View>

      <Pressable style={styles.btnLogin} onPress={() => router.push('/(auth)/login' as any)}>
        <Text style={styles.btnLoginText}>{t('auth.login')}</Text>
      </Pressable>
      <Pressable style={styles.btnRegister} onPress={() => router.push('/(auth)/register' as any)}>
        <Text style={styles.btnRegisterText}>{t('auth.register')}</Text>
      </Pressable>

      <LanguageSection />
    </ScrollView>
    </SafeAreaView>
  );
}

function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout, refreshUser } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const [uploading, setUploading] = useState(false);

  if (!user) return null;

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
      await refreshUser();
    } catch (err: any) {
      Alert.alert(t('common.error'), err.message || t('common.error'));
    } finally {
      setUploading(false);
    }
  };

  const notReady = () => Alert.alert('', t('auth.comingSoon'));

  const initials = (user.firstName?.[0] || user.email[0]).toUpperCase();
  const fullName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
  const emailVerified = !!user.emailVerified;
  const hasPhone = !!user.phone;
  const phoneVerified = !!user.phoneVerified;
  const allVerified = emailVerified && (!hasPhone || phoneVerified);

  const currentTier = user.subscriptionTier && user.subscriptionTier !== 'free' ? user.subscriptionTier : null;
  const tierColor = currentTier === 'premium' ? '#7C3AED' : currentTier === 'b2b' ? '#D97706' : '#0EA5E9';

  // Partner entry flips between "become a partner" and "partner dashboard"
  // depending on whether this user already has a partner profile.
  const partnerQ = useQuery({ queryKey: ['partner-me'], queryFn: () => api.getPartnerMe() });
  const hasPartner = !!partnerQ.data;

  const menu: Array<{ icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }> = [
    { icon: currentTier ? 'star' : 'star-outline', label: t('auth.subscription'), color: tierColor, onPress: () => router.push('/subscription' as any) },
    { icon: 'bag-handle-outline', label: t('orders.mine'), color: '#0EA5E9', onPress: () => router.push('/my-orders' as any) },
    { icon: 'notifications-outline', label: t('notifications.title'), color: '#F59E0B', onPress: () => router.push('/notifications' as any) },
    {
      icon: hasPartner ? 'briefcase' : 'briefcase-outline',
      label: hasPartner ? t('partner.dashboard') : t('partner.become'),
      color: '#015197',
      onPress: () => router.push((hasPartner ? '/partner-dashboard' : '/partner-apply') as any),
    },
    { icon: 'lock-closed-outline', label: t('auth.changePassword'), color: '#8B5CF6', onPress: () => router.push('/change-password' as any) },
    { icon: 'heart-outline', label: t('auth.favorites'), color: '#EC4899', onPress: notReady },
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
    <ScrollView contentContainerStyle={[styles.profileContent, { paddingBottom: tabBarHeight + 24 }]} showsVerticalScrollIndicator={false}>
      {/* Profile header card */}
      <View style={styles.profileCard}>
        <Pressable onPress={pickAvatar} disabled={uploading} style={styles.avatarWrap}>
          {uploading ? (
            <View style={styles.avatar}><ActivityIndicator color="#fff" size="small" /></View>
          ) : user.avatarUrl ? (
            <Image source={{ uri: user.avatarUrl }} style={styles.avatarImg} />
          ) : (
            <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>
          )}
          <View style={styles.avatarBadge}>
            <Ionicons name="camera" size={11} color="#fff" />
          </View>
        </Pressable>
        <View style={styles.profileInfo}>
          <Text style={styles.profileName} numberOfLines={1}>{fullName}</Text>
          <Text style={styles.profileEmail} numberOfLines={1}>{user.email}</Text>
        </View>
      </View>

      {/* Verification banners */}
      {!allVerified && (
        <View style={styles.verifyBanners}>
          {!emailVerified && (
            <Pressable
              style={styles.verifyBanner}
              onPress={() => router.push({ pathname: '/(auth)/verify' as any, params: { email: user.email } })}
            >
              <View style={styles.verifyBannerLeft}>
                <Ionicons name="mail-outline" size={18} color="#D97706" />
                <View>
                  <Text style={styles.verifyBannerLabel}>{t('auth.emailNotVerified')}</Text>
                  <Text style={styles.verifyBannerSub} numberOfLines={1}>{user.email}</Text>
                </View>
              </View>
              <View style={styles.verifyBannerBtn}>
                <Text style={styles.verifyBannerBtnText}>{t('auth.verifyAction')}</Text>
              </View>
            </Pressable>
          )}
          {hasPhone && !phoneVerified && (
            <Pressable
              style={[styles.verifyBanner, !emailVerified && styles.verifyBannerBorder]}
              onPress={() => router.push('/verify-phone' as any)}
            >
              <View style={styles.verifyBannerLeft}>
                <Ionicons name="phone-portrait-outline" size={18} color="#D97706" />
                <View>
                  <Text style={styles.verifyBannerLabel}>{t('auth.phoneNotVerified')}</Text>
                  <Text style={styles.verifyBannerSub} numberOfLines={1}>{user.phone}</Text>
                </View>
              </View>
              <View style={styles.verifyBannerBtn}>
                <Text style={styles.verifyBannerBtnText}>{t('auth.verifyAction')}</Text>
              </View>
            </Pressable>
          )}
          {!hasPhone && (
            <Pressable style={[styles.verifyBanner, !emailVerified && styles.verifyBannerBorder]} onPress={() => router.push('/verify-phone' as any)}>
              <View style={styles.verifyBannerLeft}>
                <Ionicons name="phone-portrait-outline" size={18} color="#D97706" />
                <Text style={styles.verifyBannerLabel}>{t('auth.addPhone')}</Text>
              </View>
              <View style={styles.verifyBannerBtn}>
                <Text style={styles.verifyBannerBtnText}>{t('auth.verifyAction')}</Text>
              </View>
            </Pressable>
          )}
        </View>
      )}

      {allVerified && (
        <View style={styles.verifiedBlock}>
          <View style={styles.verifiedRow}>
            <Ionicons name="checkmark-circle" size={15} color="#10B981" />
            <Text style={styles.verifiedRowText} numberOfLines={1}>{user.email}</Text>
          </View>
          {hasPhone && (
            <View style={[styles.verifiedRow, styles.verifiedRowBorder]}>
              <Ionicons name="checkmark-circle" size={15} color="#10B981" />
              <Text style={styles.verifiedRowText} numberOfLines={1}>{user.phone}</Text>
            </View>
          )}
        </View>
      )}

      {/* Menu */}
      <View style={styles.menuSection}>
        {menu.map(item => (
          <Pressable key={item.label} style={styles.menuItem} onPress={item.onPress}>
            <View style={styles.menuItemLeft}>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                <Ionicons name={item.icon} size={17} color={item.color} />
              </View>
              <Text style={styles.menuItemText}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#CBD5E1" />
          </Pressable>
        ))}
      </View>

      <LanguageSection />

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#EF4444" />
        <Text style={styles.logoutText}>{t('common.logout')}</Text>
      </Pressable>
    </ScrollView>
    </SafeAreaView>
  );
}

function LanguageSection() {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
  };

  return (
    <View style={styles.menuSection}>
      <Text style={styles.menuSectionTitle}>{t('settings.language')}</Text>
      <View style={styles.langIconRow}>
        {LANGUAGES.map(lang => (
          <Pressable
            key={lang.code}
            style={[styles.langIconBtn, current === lang.code && styles.langIconBtnActive]}
            onPress={() => handleLanguage(lang.code)}
          >
            <Text style={styles.langIconFlag}>{lang.flag}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' },

  // Guest
  guestContainer: { alignItems: 'center', padding: 28, paddingTop: 40 },
  guestIcon: { width: 96, height: 96, borderRadius: 48, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  guestTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B', marginBottom: 20, textAlign: 'center' },
  guestServices: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 28, width: '100%' },
  guestServiceIcon: { width: 58, height: 58, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  btnLogin: { width: '100%', height: 52, backgroundColor: BRAND, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: 12, elevation: 2, shadowColor: BRAND, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 8 },
  btnLoginText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  btnRegister: { width: '100%', height: 52, borderRadius: 14, borderWidth: 1.5, borderColor: BRAND, alignItems: 'center', justifyContent: 'center', marginBottom: 32 },
  btnRegisterText: { color: BRAND, fontSize: 16, fontWeight: '700' },

  // Profile header
  profileContent: { paddingBottom: 40 },
  profileCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  avatarWrap: { position: 'relative' },
  avatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },
  avatarImg: { width: 60, height: 60, borderRadius: 30 },
  avatarText: { fontSize: 22, fontWeight: '800', color: '#fff' },
  avatarBadge: { position: 'absolute', bottom: 0, right: 0, width: 20, height: 20, borderRadius: 10, backgroundColor: BRAND, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  profileInfo: { flex: 1 },
  profileName: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  profileEmail: { fontSize: 12, color: '#64748B', marginTop: 2 },

  // Verification banners
  verifyBanners: { backgroundColor: '#FFFBEB', borderBottomWidth: 1, borderBottomColor: '#FEF3C7', marginBottom: 8 },
  verifyBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 10 },
  verifyBannerBorder: { borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  verifyBannerLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  verifyBannerLabel: { fontSize: 13, fontWeight: '600', color: '#92400E' },
  verifyBannerSub: { fontSize: 11, color: '#B45309', marginTop: 1 },
  verifyBannerBtn: { backgroundColor: '#D97706', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  verifyBannerBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },

  // Verified block
  verifiedBlock: { backgroundColor: '#F0FDF4', borderBottomWidth: 1, borderBottomColor: '#DCFCE7', marginBottom: 8 },
  verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 9 },
  verifiedRowBorder: { borderTopWidth: 1, borderTopColor: '#DCFCE7' },
  verifiedRowText: { fontSize: 12, color: '#166534', fontWeight: '500', flex: 1 },

  // Menu
  menuSection: { backgroundColor: '#fff', marginBottom: 6, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 2 },
  menuSectionTitle: { fontSize: 11, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  menuItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F8FAFC' },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  menuIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  menuItemText: { fontSize: 14, color: '#1E293B', fontWeight: '500' },
  langIconRow: { flexDirection: 'row', gap: 10, paddingVertical: 10 },
  langIconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F1F5F9' },
  langIconBtnActive: { backgroundColor: '#E0EEFF' },
  langIconFlag: { fontSize: 20 },

  logoutBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, height: 48, borderRadius: 12, borderWidth: 1.5, borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' },
  logoutText: { color: '#EF4444', fontSize: 14, fontWeight: '700' },
});
