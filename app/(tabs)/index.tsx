import { StyleSheet, FlatList, Pressable, Text, View, SafeAreaView } from 'react-native';
import { router } from 'expo-router';
import { TOPICS } from '@/constants/topics';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🇲🇳 Mon-Go</Text>
        <Text style={styles.headerSub}>Travel Mongolia</Text>
      </View>
      <FlatList
        data={TOPICS}
        keyExtractor={(item) => item.key}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => (
          <Pressable
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
            onPress={() => router.push(`/topic/${item.key}`)}
          >
            <Text style={styles.cardIcon}>{item.icon}</Text>
            <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTitle: { fontSize: 24, fontWeight: '700' },
  headerSub: { fontSize: 13, color: '#888', marginTop: 2 },
  grid: { padding: 12, gap: 10 },
  card: {
    flex: 1,
    margin: 5,
    padding: 14,
    backgroundColor: '#f5f9ff',
    borderRadius: 14,
    alignItems: 'center',
    gap: 8,
    minHeight: 100,
    justifyContent: 'center',
  },
  cardPressed: { backgroundColor: '#e0eeff', transform: [{ scale: 0.97 }] },
  cardIcon: { fontSize: 30 },
  cardTitle: { fontSize: 11, fontWeight: '600', textAlign: 'center', color: '#333' },
});
