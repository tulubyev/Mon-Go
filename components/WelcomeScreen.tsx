import { StyleSheet, Pressable, Text, View, Image, ScrollView, Platform, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { api } from '@/services/api';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'zh' as const, flag: '🇨🇳' },
  { code: 'mn' as const, flag: '🇲🇳' },
];

const CLIPS = ['clip1', 'clip2', 'clip3', 'clip4'];

type ServerStatus = 'checking' | 'ok' | 'unreachable';

export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');

  const runCheck = useCallback(() => {
    setServerStatus('checking');
    api.getHealth().then(res => setServerStatus(res?.status === 'ok' ? 'ok' : 'unreachable'));
  }, []);

  useEffect(() => { runCheck(); }, [runCheck]);

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
    onContinue();
  };

  return (
    // Mongolian flag colors — deep blue to dark red, top to bottom.
    <LinearGradient colors={['#015197', '#7b241c']} style={styles.root}>
      <SafeAreaView style={styles.container}>
        <View style={styles.brandSection}>
          <Text style={styles.brandTitle}>MON-GO</Text>
          <Text style={styles.brandSubtitle}>{t('home.subtitle')}</Text>
        </View>

        <View style={styles.logoSection}>
          <View style={styles.frame}>
            <Image source={require('@/assets/images/logo.jpeg')} style={styles.logoImage} resizeMode="contain" />
            <ServerStatusOverlay status={serverStatus} onRetry={runCheck} t={t} />
          </View>
        </View>

        <View style={styles.carouselSection}>
          <View style={styles.frame}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselContent}>
              {CLIPS.map((clip) => (
                <View key={clip} style={styles.clipCard}>
                  <Text style={styles.clipPlay}>▶️</Text>
                  <Text style={styles.clipLabel}>{t('welcome.comingSoon')}</Text>
                </View>
              ))}
            </ScrollView>
          </View>
        </View>

        <View style={styles.langSection}>
          <View style={styles.langRow}>
            {LANGUAGES.map((lang) => (
              <Pressable
                key={lang.code}
                style={[styles.langBtn, current === lang.code && styles.langBtnActive]}
                onPress={() => handleLanguage(lang.code)}
              >
                <Text style={styles.langFlag}>{lang.flag}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

function ServerStatusOverlay({ status, onRetry, t }: { status: ServerStatus; onRetry: () => void; t: (k: string) => string }) {
  if (status === 'ok') return null;

  if (status === 'checking') {
    return (
      <View style={styles.statusOverlay} pointerEvents="none">
        <View style={styles.statusPill}>
          <ActivityIndicator size="small" color="rgba(255,255,255,0.8)" />
          <Text style={styles.statusCheckingText}>{t('welcome.checking')}</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.statusOverlay}>
      <View style={styles.statusCard}>
        <Text style={styles.statusIcon}>📡</Text>
        <Text style={styles.statusTitle}>{t('welcome.offTitle')}</Text>
        <Text style={styles.statusSubtitle}>{t('welcome.offSub')}</Text>
        <Pressable style={styles.retryBtn} onPress={onRetry}>
          <Text style={styles.retryText}>↻ {t('welcome.retry')}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  brandSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandTitle: {
    fontSize: 34, fontWeight: '800', letterSpacing: 2, color: '#fff',
    textShadowColor: 'rgba(0,0,0,0.35)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  brandSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  logoSection: { flex: 2, paddingHorizontal: 20, paddingVertical: 8 },
  carouselSection: { flex: 2, paddingHorizontal: 20, paddingVertical: 8 },
  frame: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  logoImage: { width: '100%', height: '100%' },
  carouselContent: { gap: 12, paddingHorizontal: 4, alignItems: 'stretch' },
  clipCard: {
    width: 110,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clipPlay: { fontSize: 28 },
  clipLabel: { fontSize: 11, color: 'rgba(255,255,255,0.75)', textAlign: 'center', paddingHorizontal: 6 },
  langSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  langBtnActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
  langFlag: { fontSize: 26 },

  statusOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(0,0,0,0.45)', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 8,
  },
  statusCheckingText: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '500' },
  statusCard: {
    alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 20, paddingVertical: 18, gap: 4, maxWidth: 240,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  statusIcon: { fontSize: 24 },
  statusTitle: { fontSize: 14, fontWeight: '700', color: '#FCA5A5', textAlign: 'center' },
  statusSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.7)', textAlign: 'center', marginTop: 2 },
  retryBtn: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 7 },
  retryText: { color: '#fff', fontSize: 13, fontWeight: '600' },
});
