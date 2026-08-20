import { useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet, Text, View, Pressable, Platform, ActivityIndicator, Animated,
} from 'react-native';
import { useRouter } from 'expo-router';
import { PHRASE_SECTIONS, Phrase } from '@/constants/phrases';

// Flatten all phrases with section info
const ALL_PHRASES: (Phrase & { section: string })[] = PHRASE_SECTIONS.flatMap(s =>
  s.phrases.map(p => ({ ...p, section: s.title }))
);

type PhraseWithSection = Phrase & { section: string };

function pickQuestion(): { phrase: PhraseWithSection; options: string[]; correctIndex: number } {
  const idx = Math.floor(Math.random() * ALL_PHRASES.length);
  const phrase = ALL_PHRASES[idx];

  // 3 distractors: other phrases' Russian translations
  const pool = ALL_PHRASES.filter((_, i) => i !== idx).map(p => p.ru);
  const distractors: string[] = [];
  const used = new Set<string>();
  used.add(phrase.ru);
  while (distractors.length < 3 && pool.length > 0) {
    const ri = Math.floor(Math.random() * pool.length);
    const pick = pool.splice(ri, 1)[0];
    if (!used.has(pick)) { used.add(pick); distractors.push(pick); }
  }

  const options = [...distractors, phrase.ru];
  // Shuffle options
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [options[i], options[j]] = [options[j], options[i]];
  }
  const correctIndex = options.indexOf(phrase.ru);
  return { phrase, options, correctIndex };
}

async function speakPhrase(text: string) {
  try {
    if (Platform.OS !== 'web') {
      const Speech = require('expo-speech');
      Speech.stop();
      await new Promise<void>((resolve) => {
        Speech.speak(text, { language: 'mn-MN', onDone: resolve, onError: resolve, onStopped: resolve });
      });
    }
  } catch {
    // silent
  }
}

export default function QuizScreen() {
  const router = useRouter();
  const [question, setQuestion] = useState(() => pickQuestion());
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [speaking, setSpeaking] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  const play = useCallback(async () => {
    setSpeaking(true);
    await speakPhrase(question.phrase.mn);
    setSpeaking(false);
  }, [question]);

  // Auto-play when question loads
  useEffect(() => {
    play();
  }, [question.phrase.mn]);

  const choose = useCallback((index: number) => {
    if (selected !== null) return;
    setSelected(index);
    const correct = index === question.correctIndex;
    setScore(s => ({ correct: s.correct + (correct ? 1 : 0), total: s.total + 1 }));
  }, [selected, question]);

  const next = useCallback(() => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setSelected(null);
    setQuestion(pickQuestion());
  }, [fadeAnim]);

  const pct = score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;

  return (
    <View style={styles.container}>
      {/* Score bar */}
      <View style={styles.scoreBar}>
        <Text style={styles.scoreText}>✅ {score.correct} / {score.total}</Text>
        {score.total > 0 && (
          <Text style={[styles.pctText, { color: pct >= 70 ? '#22c55e' : '#ef4444' }]}>{pct}%</Text>
        )}
        <Pressable onPress={() => router.back()} style={styles.exitBtn}>
          <Text style={styles.exitBtnText}>✕ Выйти</Text>
        </Pressable>
      </View>

      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* Section label */}
        <Text style={styles.sectionLabel}>{question.phrase.section}</Text>

        {/* Play button */}
        <Pressable style={[styles.playBtn, speaking && styles.playBtnActive]} onPress={play} disabled={speaking}>
          {speaking
            ? <ActivityIndicator size="large" color="#fff" />
            : <Text style={styles.playIcon}>🔊</Text>
          }
        </Pressable>
        <Text style={styles.playHint}>Нажми чтобы прослушать</Text>

        {/* Mongolian text (shown after selection) */}
        {selected !== null && (
          <View style={styles.phraseReveal}>
            <Text style={styles.phraseMn}>{question.phrase.mn}</Text>
            <Text style={styles.phraseRoman}>{question.phrase.romanization}</Text>
          </View>
        )}

        {/* Options */}
        <View style={styles.options}>
          {question.options.map((opt, i) => {
            let optStyle = styles.optionDefault;
            let textStyle = styles.optionTextDefault;
            if (selected !== null) {
              if (i === question.correctIndex) {
                optStyle = styles.optionCorrect;
                textStyle = styles.optionTextCorrect;
              } else if (i === selected && i !== question.correctIndex) {
                optStyle = styles.optionWrong;
                textStyle = styles.optionTextWrong;
              }
            }
            return (
              <Pressable
                key={i}
                style={[styles.option, optStyle]}
                onPress={() => choose(i)}
                disabled={selected !== null}
              >
                <Text style={styles.optionLetter}>{String.fromCharCode(65 + i)}.</Text>
                <Text style={[styles.optionText, textStyle]}>{opt}</Text>
                {selected !== null && i === question.correctIndex && (
                  <Text style={styles.optionCheck}>✓</Text>
                )}
                {selected === i && i !== question.correctIndex && (
                  <Text style={styles.optionX}>✗</Text>
                )}
              </Pressable>
            );
          })}
        </View>

        {/* Result feedback */}
        {selected !== null && (
          <View style={styles.feedback}>
            <Text style={[styles.feedbackText, { color: selected === question.correctIndex ? '#22c55e' : '#ef4444' }]}>
              {selected === question.correctIndex ? '🎉 Правильно!' : `❌ Нет. Правильно: «${question.phrase.ru}»`}
            </Text>
            <Pressable style={styles.nextBtn} onPress={next}>
              <Text style={styles.nextBtnText}>Следующий →</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  scoreBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#eee', gap: 8 },
  scoreText: { fontSize: 15, fontWeight: '700', color: '#1a1a1a', flex: 1 },
  pctText: { fontSize: 14, fontWeight: '700' },
  exitBtn: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: '#f5f5f5' },
  exitBtnText: { fontSize: 13, color: '#666', fontWeight: '600' },
  card: { flex: 1, alignItems: 'center', paddingHorizontal: 20, paddingTop: 32 },
  sectionLabel: { fontSize: 13, color: '#888', marginBottom: 20 },
  playBtn: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center', shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10, elevation: 8 },
  playBtnActive: { backgroundColor: '#93c5fd' },
  playIcon: { fontSize: 40 },
  playHint: { fontSize: 12, color: '#aaa', marginTop: 10, marginBottom: 20 },
  phraseReveal: { alignItems: 'center', marginBottom: 20, padding: 12, backgroundColor: '#f0f7ff', borderRadius: 12, width: '100%' },
  phraseMn: { fontSize: 18, fontWeight: '700', color: '#1a1a1a', textAlign: 'center' },
  phraseRoman: { fontSize: 13, color: '#3b82f6', marginTop: 4 },
  options: { width: '100%', gap: 10, marginTop: 4 },
  option: { flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 12, borderWidth: 2, gap: 10 },
  optionDefault: { backgroundColor: '#fff', borderColor: '#e5e7eb' },
  optionCorrect: { backgroundColor: '#dcfce7', borderColor: '#22c55e' },
  optionWrong: { backgroundColor: '#fee2e2', borderColor: '#ef4444' },
  optionLetter: { fontSize: 14, fontWeight: '700', color: '#aaa', width: 20 },
  optionText: { flex: 1, fontSize: 15 },
  optionTextDefault: { color: '#1a1a1a' },
  optionTextCorrect: { color: '#15803d', fontWeight: '600' },
  optionTextWrong: { color: '#b91c1c', fontWeight: '600' },
  optionCheck: { fontSize: 18, color: '#22c55e' },
  optionX: { fontSize: 18, color: '#ef4444' },
  feedback: { marginTop: 20, alignItems: 'center', gap: 12, width: '100%' },
  feedbackText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  nextBtn: { backgroundColor: '#3b82f6', paddingHorizontal: 32, paddingVertical: 13, borderRadius: 14, width: '100%', alignItems: 'center' },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
