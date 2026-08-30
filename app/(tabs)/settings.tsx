import { StyleSheet, Text, View, Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { changeLanguage, getCurrentLanguage } from '@/lib/i18n';
import { useState } from 'react';

const LANGUAGES = [
  { code: 'ru' as const, flag: '🇷🇺', nativeName: 'Русский' },
  { code: 'en' as const, flag: '🇬🇧', nativeName: 'English' },
  { code: 'zh' as const, flag: '🇨🇳', nativeName: '中文' },
  { code: 'mn' as const, flag: '🇲🇳', nativeName: 'Монгол' },
];

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const [current, setCurrent] = useState(getCurrentLanguage());

  const handleLanguage = async (code: 'ru' | 'en' | 'zh' | 'mn') => {
    await changeLanguage(code);
    setCurrent(code);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('settings.title')}</Text>
      </View>

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
});
