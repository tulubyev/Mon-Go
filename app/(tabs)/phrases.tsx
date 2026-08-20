import { useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, ScrollView, Pressable, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PHRASE_SECTIONS, Phrase } from '@/constants/phrases';
import { api } from '@/services/api';

export default function PhrasesScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<number>>(new Set([0]));
  const [speaking, setSpeaking] = useState<string | null>(null);

  const toggle = useCallback((index: number) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const speak = useCallback(async (phrase: Phrase) => {
    if (speaking === phrase.mn) return;
    setSpeaking(phrase.mn);
    try {
      if (Platform.OS !== 'web') {
        const Speech = require('expo-speech');
        await new Promise<void>((resolve, reject) => {
          Speech.speak(phrase.mn, {
            language: 'mn-MN',
            onDone: resolve,
            onError: reject,
            onStopped: resolve,
          });
        });
      } else {
        const url = api.tts(phrase.mn, 'mn');
        const audio = new Audio(url);
        await new Promise<void>((resolve) => {
          audio.onended = () => resolve();
          audio.onerror = () => resolve();
          audio.play().catch(() => resolve());
        });
      }
    } catch {
      // expo-speech may not support mn-MN — silently fail
    } finally {
      setSpeaking(null);
    }
  }, [speaking]);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <Text style={styles.headerTitle}>Монгольские фразы</Text>
          <Pressable style={styles.quizBtn} onPress={() => router.push('/quiz')}>
            <Text style={styles.quizBtnText}>🎯 Квиз</Text>
          </Pressable>
        </View>
        <Text style={styles.headerSub}>{PHRASE_SECTIONS.length} разделов · нажми 🔊 для произношения</Text>
      </View>
      <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
        {PHRASE_SECTIONS.map((section, si) => {
          const isOpen = expanded.has(si);
          return (
            <View key={si} style={styles.section}>
              <Pressable style={styles.sectionHeader} onPress={() => toggle(si)}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <View style={styles.sectionMeta}>
                  <Text style={styles.sectionCount}>{section.phrases.length}</Text>
                  <Text style={styles.chevron}>{isOpen ? '▲' : '▼'}</Text>
                </View>
              </Pressable>
              {isOpen && (
                <View style={styles.phraseList}>
                  {section.phrases.map((phrase, pi) => (
                    <PhraseRow
                      key={pi}
                      phrase={phrase}
                      isSpeaking={speaking === phrase.mn}
                      onSpeak={() => speak(phrase)}
                    />
                  ))}
                </View>
              )}
            </View>
          );
        })}
        <View style={styles.bottomPad} />
      </ScrollView>
    </View>
  );
}

function PhraseRow({
  phrase, isSpeaking, onSpeak,
}: { phrase: Phrase; isSpeaking: boolean; onSpeak: () => void }) {
  return (
    <View style={styles.phraseRow}>
      <View style={styles.phraseTexts}>
        <Text style={styles.phraseMn}>{phrase.mn}</Text>
        <Text style={styles.phraseRoman}>{phrase.romanization}</Text>
        <Text style={styles.phraseRu}>{phrase.ru}</Text>
      </View>
      <Pressable
        style={[styles.speakBtn, isSpeaking && styles.speakBtnActive]}
        onPress={onSpeak}
        disabled={isSpeaking}
      >
        {isSpeaking
          ? <ActivityIndicator size="small" color="#fff" />
          : <Text style={styles.speakBtnText}>🔊</Text>
        }
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { backgroundColor: '#fff', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#1a1a1a' },
  headerSub: { fontSize: 12, color: '#888', marginTop: 2 },
  quizBtn: { backgroundColor: '#f59e0b', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 },
  quizBtnText: { fontSize: 13, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  section: { marginTop: 8, marginHorizontal: 12, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', flex: 1 },
  sectionMeta: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionCount: { fontSize: 12, color: '#888', backgroundColor: '#f0f0f0', paddingHorizontal: 7, paddingVertical: 2, borderRadius: 10 },
  chevron: { fontSize: 11, color: '#aaa' },
  phraseList: { borderTopWidth: 1, borderTopColor: '#f0f0f0' },
  phraseRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5', gap: 10 },
  phraseTexts: { flex: 1 },
  phraseMn: { fontSize: 15, fontWeight: '600', color: '#1a1a1a', marginBottom: 2 },
  phraseRoman: { fontSize: 12, color: '#3b82f6', marginBottom: 2 },
  phraseRu: { fontSize: 13, color: '#555' },
  speakBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  speakBtnActive: { backgroundColor: '#93c5fd' },
  speakBtnText: { fontSize: 16 },
  bottomPad: { height: 20 },
});
