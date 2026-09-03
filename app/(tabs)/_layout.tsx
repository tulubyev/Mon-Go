import { Tabs } from 'expo-router';
import { Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          headerShown: false,
          tabBarLabel: t('tabs.home'),
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🏠" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: t('tabs.map'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="phrases"
        options={{
          title: t('tabs.phrases'),
          tabBarLabel: t('tabs.phrases'),
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🗣️" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: t('tabs.chat'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="ads"
        options={{
          title: t('tabs.ads'),
          href: null,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: t('settings.title'),
          tabBarLabel: t('settings.title'),
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="⚙️" color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

function TabIcon({ emoji }: { emoji: string; color?: unknown }) {
  const { Text } = require('react-native');
  return <Text style={{ fontSize: 22 }}>{emoji}</Text>;
}
