import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '@/lib/i18n';
import { initI18n } from '@/lib/i18n';
import { useTranslation } from 'react-i18next';
import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { useColorScheme } from '@/components/useColorScheme';
import WelcomeScreen from '@/components/WelcomeScreen';
import { AuthProvider } from '@/contexts/AuthContext';

// Mongolia has no mobile coverage outside the cities: keep data usable for a
// long time and never retry into a dead network more than once.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,
      gcTime: 24 * 60 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

// Persist the cache to disk so Wiki/Partners/rates survive an app restart —
// closing the app is the common case out in the steppe, not just backgrounding it.
const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'mongo-query-cache',
});

export {
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const [i18nReady, setI18nReady] = useState(false);

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    initI18n().then(() => setI18nReady(true));
  }, []);

  useEffect(() => {
    if (loaded && i18nReady) {
      SplashScreen.hideAsync();
    }
  }, [loaded, i18nReady]);

  if (!loaded || !i18nReady) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <RootLayoutNav />
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const [showWelcome, setShowWelcome] = useState(true);

  if (showWelcome) {
    return <WelcomeScreen onContinue={() => setShowWelcome(false)} />;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <AuthProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
            <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
            <Stack.Screen name="quiz" options={{ title: t('quiz.title'), headerBackTitle: t('common.back') }} />
            <Stack.Screen name="ocr" options={{ title: t('ocr.title'), headerBackTitle: t('common.back') }} />
            <Stack.Screen name="interpreter" options={{ title: t('interpreter.title'), headerBackTitle: t('common.back'), headerShown: false }} />
            <Stack.Screen name="transport" options={{ headerShown: false }} />
            <Stack.Screen name="wiki/[id]" options={{ headerShown: false }} />
            <Stack.Screen name="change-password" options={{ title: t('auth.changePassword'), headerBackTitle: t('common.back') }} />
            <Stack.Screen name="verify-phone" options={{ title: t('auth.verifyPhoneTitle'), headerBackTitle: t('common.back') }} />
          </Stack>
        </ThemeProvider>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
