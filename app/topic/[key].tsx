import { StyleSheet, ScrollView, Pressable, Text, View, SafeAreaView } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { TOPICS } from '@/constants/topics';

export default function TopicScreen() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const topic = TOPICS.find((t) => t.key === key);

  if (!topic) return (
    <View style={styles.center}>
      <Text>Тема не найдена</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: `${topic.icon} ${topic.title}` }} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.overview}>
          <Text style={styles.overviewText}>{topic.overview}</Text>
        </View>
        <Text style={styles.subheading}>Вопросы</Text>
        {topic.subquestions.map((sq, idx) => (
          <Pressable
            key={idx}
            style={({ pressed }) => [styles.sqBtn, pressed && styles.sqBtnPressed]}
            onPress={() => {
              if (sq.specialSlide === 'phrases') {
                router.push('/phrases');
              } else if (sq.q) {
                router.push({ pathname: '/chat', params: { question: sq.q, label: sq.label } });
              }
            }}
          >
            <Text style={styles.sqLabel}>{sq.label}</Text>
            <Text style={styles.sqArrow}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 16, gap: 10 },
  overview: { backgroundColor: '#f5f9ff', borderRadius: 12, padding: 14, marginBottom: 8 },
  overviewText: { fontSize: 14, lineHeight: 22, color: '#333' },
  subheading: { fontSize: 13, fontWeight: '600', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  sqBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    backgroundColor: '#fff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#eee',
    justifyContent: 'space-between',
  },
  sqBtnPressed: { backgroundColor: '#f0f7ff' },
  sqLabel: { fontSize: 15, flex: 1 },
  sqArrow: { fontSize: 20, color: '#aaa' },
});
