import { StyleSheet, Pressable, Text, View, Image, ScrollView, SafeAreaView } from 'react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺' },
  { code: 'en' as const, flag: '🇬🇧' },
  { code: 'zh' as const, flag: '🇨🇳' },
  { code: 'mn' as const, flag: '🇲🇳' },
];

const CLIPS = ['clip1', 'clip2', 'clip3', 'clip4'];

export default function WelcomeScreen({ onContinue }: { onContinue: () => void }) {
  const { t } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
    onContinue();
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.brandSection}>
        <Text style={styles.brandTitle}>MON-GO</Text>
        <Text style={styles.brandSubtitle}>{t('home.subtitle')}</Text>
      </View>

      <View style={styles.logoSection}>
        <View style={styles.frame}>
          <Image source={require('@/assets/images/logo.jpeg')} style={styles.logoImage} resizeMode="contain" />
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
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  brandSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  brandTitle: { fontSize: 34, fontWeight: '800', letterSpacing: 2, color: '#1a1a1a' },
  brandSubtitle: { fontSize: 14, color: '#888', marginTop: 4 },
  logoSection: { flex: 2, paddingHorizontal: 20, paddingVertical: 8 },
  carouselSection: { flex: 2, paddingHorizontal: 20, paddingVertical: 8 },
  frame: {
    flex: 1,
    backgroundColor: '#f5f9ff',
    borderRadius: 20,
    overflow: 'hidden',
    padding: 12,
  },
  logoImage: { width: '100%', height: '100%' },
  carouselContent: { gap: 12, paddingHorizontal: 4, alignItems: 'stretch' },
  clipCard: {
    width: 110,
    backgroundColor: '#e8f0fe',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  clipPlay: { fontSize: 28 },
  clipLabel: { fontSize: 11, color: '#5a6b8a', textAlign: 'center', paddingHorizontal: 6 },
  langSection: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  langRow: { flexDirection: 'row', gap: 10 },
  langBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  langBtnActive: { backgroundColor: '#e0eeff' },
  langFlag: { fontSize: 26 },
});
