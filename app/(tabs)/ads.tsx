import { StyleSheet, Text, View, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';

// "Услуги" is now a hub, not a listing itself — two graphically separate
// blocks (Партнёры / Объявления), each opening in its own screen and each
// with its own "+" to jump straight to that screen's add-new form.
export default function ServicesHubScreen() {
  const { t } = useTranslation();

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <Stack.Screen options={{ title: t('tabs.ads'), headerBackTitle: t('common.back') }} />
      <View style={styles.body}>
        <HubBlock
          icon="people"
          color="#3b82f6"
          title="Партнёры"
          subtitle="Турфирмы, гиды, отели, прокат авто, визы"
          onPress={() => router.push('/partners' as any)}
          onAdd={() => router.push('/partner-apply' as any)}
        />
        <HubBlock
          icon="megaphone"
          color="#f97316"
          title="Объявления"
          subtitle="Попутчики, жильё, продам, ищу"
          onPress={() => router.push('/ads-list' as any)}
          onAdd={() => router.push('/ads-list?new=1' as any)}
        />
      </View>
    </SafeAreaView>
  );
}

function HubBlock({ icon, color, title, subtitle, onPress, onAdd }: {
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  title: string;
  subtitle: string;
  onPress: () => void;
  onAdd: () => void;
}) {
  return (
    <Pressable style={styles.block} onPress={onPress}>
      <View style={[styles.blockIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={26} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.blockTitle}>{title}</Text>
        <Text style={styles.blockSubtitle}>{subtitle}</Text>
      </View>
      <Pressable
        style={[styles.addBtn, { backgroundColor: color }]}
        onPress={(e) => { e.stopPropagation(); onAdd(); }}
        hitSlop={8}
      >
        <Ionicons name="add" size={20} color="#fff" />
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  body: { padding: 16, gap: 12 },
  block: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: '#fff', borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  blockIcon: { width: 52, height: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  blockTitle: { fontSize: 17, fontWeight: '700', color: '#1a1a1a' },
  blockSubtitle: { fontSize: 12, color: '#888', marginTop: 2 },
  addBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});
