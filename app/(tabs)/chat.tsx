import { StyleSheet, Text, View } from 'react-native';

export default function ChatScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>💬</Text>
      <Text style={styles.title}>AI Чат</Text>
      <Text style={styles.sub}>Задайте вопрос о Монголии</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  emoji: { fontSize: 56 },
  title: { fontSize: 20, fontWeight: '700' },
  sub: { fontSize: 14, color: '#888' },
});
