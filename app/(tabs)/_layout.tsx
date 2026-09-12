import { Tabs, router } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';
import { useRef } from 'react';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// Two Home-tab taps within this window count as a double-tap.
const DOUBLE_TAP_MS = 400;

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

/**
 * Four visible tabs: Home, Wiki, Map, Account. Услуги (ads) came off the bar
 * too — it's a home-grid tile now, same as Partners already was. Every
 * screen reachable only from a home-tile / banner (chat, phrases, partners,
 * ads, photos, videos, events, calendar, transport, topic/[key] — the
 * generic wiki-topic template) stays registered here rather than as a
 * top-level Stack screen specifically so the bottom tab bar keeps showing
 * while they're open — a screen outside this Tabs group renders full-screen
 * with no bar at all, which is exactly the bug this fixes.
 */
export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();
  const isDark = colorScheme === 'dark';
  const isIOS = Platform.OS === 'ios';
  const isWeb = Platform.OS === 'web';
  const lastHomeTap = useRef(0);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        tabBarInactiveTintColor: isDark ? '#888' : '#666',
        headerShown: false,
        tabBarStyle: {
          ...(isIOS || isWeb ? { position: 'absolute' } : {}),
          backgroundColor: isIOS ? 'transparent' : isDark ? '#000' : '#fff',
          borderTopWidth: isWeb ? 1 : 0,
          borderTopColor: isDark ? '#333' : '#e5e7eb',
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={100} tint={isDark ? 'dark' : 'light'} style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: isDark ? '#000' : '#fff' }]} />
          ) : null,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color, size }) => <Ionicons name="home" color={color} size={size} />,
        }}
        listeners={{
          tabPress: (e) => {
            const now = Date.now();
            const isDoubleTap = now - lastHomeTap.current < DOUBLE_TAP_MS;
            lastHomeTap.current = now;
            if (isDoubleTap) {
              e.preventDefault();
              router.push('/welcome' as any);
            }
          },
        }}
      />
      <Tabs.Screen
        name="wiki"
        options={{
          tabBarLabel: t('tabs.wiki'),
          tabBarIcon: ({ color, size }) => <Ionicons name="book" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          tabBarLabel: t('tabs.map'),
          tabBarIcon: ({ color, size }) => <Ionicons name="map" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: t('settings.title'),
          tabBarIcon: ({ color, size }) => <Ionicons name="person-circle" color={color} size={size} />,
        }}
      />

      {/* Reachable from home-screen cards / the Services banner, not shown in the bar. */}
      <Tabs.Screen name="chat" options={{ title: t('tabs.chat'), href: null }} />
      <Tabs.Screen name="phrases" options={{ title: t('tabs.phrases'), href: null }} />
      <Tabs.Screen name="partners" options={{ title: t('tabs.partners'), href: null }} />
      <Tabs.Screen name="ads" options={{ title: t('tabs.ads'), href: null }} />
      <Tabs.Screen name="photos" options={{ title: 'Фото', href: null }} />
      <Tabs.Screen name="videos" options={{ title: 'Видео', href: null }} />
      <Tabs.Screen name="events" options={{ title: 'События', href: null }} />
      <Tabs.Screen name="calendar" options={{ title: 'Календарь', href: null }} />
      <Tabs.Screen name="transport" options={{ href: null }} />
      <Tabs.Screen name="topic/[key]" options={{ href: null }} />
    </Tabs>
  );
}
