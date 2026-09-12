import { StyleSheet, Pressable, Text, View, Image, ActivityIndicator, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { api } from '@/services/api';
import SequentialVideoBlock, { FALLBACK_CATALOG, buildSeasonalPlaylist, toClip } from '@/components/SequentialVideo';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'zh' as const, flag: '🇨🇳' },
  { code: 'mn' as const, flag: '🇲🇳' },
];

type ServerStatus = 'checking' | 'ok' | 'unreachable';

export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());
  const [serverStatus, setServerStatus] = useState<ServerStatus>('checking');

  // Каталог роликов управляется из бэкенда (welcome_videos), не зашит в код
  // — см. components/SequentialVideo.tsx. FALLBACK_CATALOG пуст, пока нет
  // реальных отснятых роликов о Монголии: оба блока тогда просто показывают
  // свой градиент без видео, а не 404 на несуществующий плейсхолдер.
  const { data: catalog } = useQuery({
    queryKey: ['welcome-videos'],
    queryFn: async () => {
      const { videos } = await api.getWelcomeVideos();
      return videos.map(toClip);
    },
    staleTime: 10 * 60 * 1000,
    retry: 1,
  });
  const playlist = buildSeasonalPlaylist(catalog && catalog.length > 0 ? catalog : FALLBACK_CATALOG);

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
        {/* First video block — brand emblem overlay */}
        <View style={styles.videoBlock}>
          <SequentialVideoBlock playlist={playlist} startIndex={0} />
          <View style={styles.emblemOverlay} pointerEvents="none">
            <Image source={require('@/assets/images/logo.jpeg')} style={styles.emblemImage} resizeMode="contain" />
          </View>
        </View>

        {/* Second video block — server status overlay */}
        <View style={styles.videoBlock}>
          <SequentialVideoBlock playlist={playlist} startIndex={1} />
          <ServerStatusOverlay status={serverStatus} onRetry={runCheck} t={t} />
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
  container: { flex: 1, paddingHorizontal: 20, paddingVertical: Platform.OS === 'web' ? 24 : 16, gap: 10 },
  videoBlock: {
    flex: 1,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.30)',
  },
  emblemOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemImage: {
    width: '55%',
    height: '55%',
    borderRadius: 20,
  },

  langSection: { alignItems: 'center', justifyContent: 'center', paddingTop: 4 },
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
