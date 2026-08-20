import { Tabs } from 'expo-router';
import { Platform } from 'react-native';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme].tint,
        headerShown: useClientOnlyValue(false, true),
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Mon-Go',
          tabBarLabel: 'Главная',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🏠" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Карта',
          tabBarLabel: 'Карта',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🗺️" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="phrases"
        options={{
          title: 'Фразы',
          tabBarLabel: 'Фразы',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="🗣️" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="chat"
        options={{
          title: 'AI Чат',
          tabBarLabel: 'Чат',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="💬" color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="ads"
        options={{
          title: 'Объявления',
          tabBarLabel: 'Объявл.',
          tabBarIcon: ({ color }) => (
            <TabIcon emoji="📋" color={color} />
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
