import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
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
  const { t } = useTranslation();
  const [showWelcome, setShowWelcome] = useState(true);

  if (showWelcome) {
    return <WelcomeScreen onContinue={() => setShowWelcome(false)} />;
  }

  return (
    <PersistQueryClientProvider client={queryClient} persistOptions={{ persister: asyncStoragePersister }}>
      <AuthProvider>
        {/* No explicit light/dark ThemeProvider — @react-navigation/native v7
            dropped the standalone component (DarkTheme/DefaultTheme are just
            plain objects now, no longer paired with a provider export from
            expo-router). Native-stack headers pick up the OS appearance on
            their own; Mon-Go never customized colors.background/card beyond
            that stock light/dark switch, so there's nothing lost here. */}
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
          <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
          <Stack.Screen name="quiz" options={{ title: t('quiz.title'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="ocr" options={{ title: t('ocr.title'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="interpreter" options={{ title: t('interpreter.title'), headerBackTitle: t('common.back'), headerShown: false }} />
          <Stack.Screen name="wiki/[id]" options={{ headerShown: false }} />
          <Stack.Screen name="change-password" options={{ title: t('auth.changePassword'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="verify-phone" options={{ title: t('auth.verifyPhoneTitle'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="subscription" options={{ title: t('auth.subscription'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="partner-apply" options={{ title: t('partner.applyTitle'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="partner-dashboard" options={{ title: t('partner.dashboard'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="partner-profile" options={{ title: t('partner.editProfile'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="my-orders" options={{ title: t('orders.mine'), headerBackTitle: t('common.back') }} />
          <Stack.Screen name="notifications" options={{ title: t('notifications.title'), headerBackTitle: t('common.back') }} />
          {/* photos/videos/events/calendar/transport/topic/[key] moved into
              (tabs) — they used to live here as top-level Stack screens,
              which rendered full-screen with no bottom tab bar. Registering
              them inside the Tabs group instead (as hidden tabs, see
              (tabs)/_layout.tsx) keeps the bar visible, same as
              ads/chat/phrases/partners. */}
          <Stack.Screen name="welcome" options={{ headerShown: false, presentation: 'fullScreenModal' }} />
        </Stack>
      </AuthProvider>
    </PersistQueryClientProvider>
  );
}
