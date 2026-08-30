import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ru from '@/locales/ru/common.json';
import en from '@/locales/en/common.json';
import zh from '@/locales/zh/common.json';
import mn from '@/locales/mn/common.json';

const LANGUAGE_KEY = 'user_language';
const SUPPORTED = ['ru', 'en', 'zh', 'mn'];

const getDefaultLanguage = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (saved && SUPPORTED.includes(saved)) return saved;
    const locales = Localization.getLocales();
    const device = (locales[0]?.languageCode ?? 'ru').split('-')[0];
    if (SUPPORTED.includes(device)) return device;
    return 'ru';
  } catch {
    return 'ru';
  }
};

export const initI18n = async () => {
  const lng = await getDefaultLanguage();
  await i18n.use(initReactI18next).init({
    compatibilityJSON: 'v3',
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      zh: { translation: zh },
      mn: { translation: mn },
    },
    lng,
    fallbackLng: 'ru',
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
  });
  return i18n;
};

export const changeLanguage = async (lang: 'ru' | 'en' | 'zh' | 'mn') => {
  try {
    await AsyncStorage.setItem(LANGUAGE_KEY, lang);
    if (!i18n.isInitialized) await initI18n();
    await i18n.changeLanguage(lang);
  } catch (e) {
    console.error('Language change error:', e);
  }
};

export const getCurrentLanguage = (): string => i18n.language || 'ru';

export default i18n;
