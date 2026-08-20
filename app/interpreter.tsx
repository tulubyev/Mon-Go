import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView, Modal,
  Platform, ActivityIndicator, SafeAreaView, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/services/api';

interface Response { mn: string; ru: string; }

type Stage = 'idle' | 'recording' | 'processing' | 'result';

async function speak(text: string) {
  if (Platform.OS === 'web') return;
  try {
    const Speech = require('expo-speech');
    Speech.stop();
    await new Promise<void>((resolve) =>
      Speech.speak(text, { language: 'mn-MN', onDone: resolve, onError: resolve })
    );
  } catch { /* silent */ }
}

export default function InterpreterScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('idle');
  const [transcript, setTranscript] = useState('');
  const [translation, setTranslation] = useState('');
  const [responses, setResponses] = useState<Response[]>([]);
  const [fullscreen, setFullscreen] = useState<Response | null>(null);
  const [speakingIdx, setSpeakingIdx] = useState<number | null>(null);
  const recordingRef = useRef<any>(null);

  const startRecording = useCallback(async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Запись', 'Запись голоса доступна только в мобильном приложении iOS/Android');
      return;
    }
    try {
      const { Audio } = require('expo-av');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      await recording.startAsync();
      recordingRef.current = recording;
      setStage('recording');
    } catch (err: any) {
      Alert.alert('Ошибка', 'Не удалось запустить запись: ' + err.message);
    }
  }, []);

  const stopAndProcess = useCallback(async () => {
    if (!recordingRef.current) return;
    setStage('processing');
    setTranscript('');
    setTranslation('');
    setResponses([]);
    try {
      const { Audio } = require('expo-av');
      const FileSystem = require('expo-file-system');
      const recording = recordingRef.current;
      recordingRef.current = null;
      await recording.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = recording.getURI();
      if (!uri) throw new Error('No audio URI');

      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      // FileSystem cleanup
      await FileSystem.deleteAsync(uri, { idempotent: true });

      // STT
      const sttResult = await api.stt(base64, 'mn', 'audio/m4a');
      const text = sttResult.text?.trim();
      if (!text) throw new Error('Речь не распознана');
      setTranscript(text);

      // Interpret
      const interp = await api.interpret(text);
      setTranslation(interp.translation || '');
      setResponses(interp.responses || []);
      setStage('result');

      // Auto-speak first response
      if (interp.responses?.[0]) {
        await speak(interp.responses[0].mn);
      }
    } catch (err: any) {
      Alert.alert('Ошибка', err.message || 'Не удалось обработать запись');
      setStage('idle');
    }
  }, []);

  const speakResponse = useCallback(async (resp: Response, idx: number) => {
    setSpeakingIdx(idx);
    await speak(resp.mn);
    setSpeakingIdx(null);
  }, []);

  const reset = useCallback(() => {
    setStage('idle');
    setTranscript('');
    setTranslation('');
    setResponses([]);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>← Назад</Text>
        </Pressable>
        <Text style={styles.headerTitle}>🎙️ Живой переводчик</Text>
        <View style={{ width: 70 }} />
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        {/* Record area */}
        <View style={styles.recordArea}>
          <Text style={styles.hint}>
            {stage === 'idle' && 'Нажми и держи — говори по-монгольски\nили слушай монгола'}
            {stage === 'recording' && 'Запись... отпусти когда закончишь'}
            {stage === 'processing' && 'Распознаём речь...'}
            {stage === 'result' && transcript}
          </Text>

          {stage === 'processing' ? (
            <ActivityIndicator size="large" color="#3b82f6" style={styles.spinner} />
          ) : (
            <Pressable
              style={[styles.micBtn, stage === 'recording' && styles.micBtnRecording]}
              onPressIn={stage === 'idle' ? startRecording : undefined}
              onPressOut={stage === 'recording' ? stopAndProcess : undefined}
              onPress={stage === 'result' ? reset : undefined}
              disabled={false}
            >
              <Text style={styles.micIcon}>
                {stage === 'result' ? '🔄' : '🎙️'}
              </Text>
              <Text style={styles.micLabel}>
                {stage === 'idle' && 'Держи для записи'}
                {stage === 'recording' && 'Отпусти'}
                {stage === 'result' && 'Заново'}
              </Text>
            </Pressable>
          )}

          {/* Web placeholder */}
          {Platform.OS === 'web' && stage === 'idle' && (
            <View style={styles.webNote}>
              <Text style={styles.webNoteText}>🎙️ Запись доступна только в мобильном приложении</Text>
            </View>
          )}
        </View>

        {/* Translation */}
        {translation !== '' && (
          <View style={styles.translationBox}>
            <Text style={styles.translationLabel}>Перевод</Text>
            <Text style={styles.translationText}>{translation}</Text>
          </View>
        )}

        {/* Response variants */}
        {responses.length > 0 && (
          <View style={styles.responsesSection}>
            <Text style={styles.responsesTitle}>Варианты ответа</Text>
            {responses.map((resp, idx) => (
              <View key={idx} style={styles.responseCard}>
                <View style={styles.responseTexts}>
                  <Text style={styles.responseMn}>{resp.mn}</Text>
                  <Text style={styles.responseRu}>{resp.ru}</Text>
                </View>
                <View style={styles.responseActions}>
                  <Pressable
                    style={styles.speakBtn}
                    onPress={() => speakResponse(resp, idx)}
                    disabled={speakingIdx !== null}
                  >
                    {speakingIdx === idx
                      ? <ActivityIndicator size="small" color="#fff" />
                      : <Text style={styles.speakBtnIcon}>🔊</Text>
                    }
                  </Pressable>
                  <Pressable
                    style={styles.showBtn}
                    onPress={() => setFullscreen(resp)}
                  >
                    <Text style={styles.showBtnIcon}>📱</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Fullscreen "Show to Mongol" modal */}
      <Modal visible={!!fullscreen} animationType="fade" statusBarTranslucent>
        <View style={styles.fullscreenModal}>
          <Pressable style={styles.fullscreenClose} onPress={() => setFullscreen(null)}>
            <Text style={styles.fullscreenCloseText}>✕ Закрыть</Text>
          </Pressable>
          <View style={styles.fullscreenContent}>
            <Text style={styles.fullscreenMn}>{fullscreen?.mn}</Text>
            <Text style={styles.fullscreenRu}>{fullscreen?.ru}</Text>
            <Pressable
              style={styles.fullscreenSpeak}
              onPress={() => fullscreen && speak(fullscreen.mn)}
            >
              <Text style={styles.fullscreenSpeakText}>🔊 Произнести</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f172a' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#1e293b' },
  backBtn: { width: 70 },
  backBtnText: { color: '#94a3b8', fontSize: 14 },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#fff' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, gap: 16 },
  recordArea: { alignItems: 'center', gap: 16, paddingVertical: 20 },
  hint: { color: '#94a3b8', fontSize: 15, textAlign: 'center', lineHeight: 22, minHeight: 50 },
  spinner: { marginVertical: 20 },
  micBtn: {
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: '#3b82f6',
    alignItems: 'center', justifyContent: 'center', gap: 4,
    shadowColor: '#3b82f6', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 20, elevation: 12,
  },
  micBtnRecording: { backgroundColor: '#ef4444', shadowColor: '#ef4444' },
  micIcon: { fontSize: 44 },
  micLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
  webNote: { backgroundColor: '#1e293b', borderRadius: 10, padding: 12, marginTop: 8 },
  webNoteText: { color: '#64748b', fontSize: 13, textAlign: 'center' },
  translationBox: { backgroundColor: '#1e293b', borderRadius: 14, padding: 16 },
  translationLabel: { fontSize: 11, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6 },
  translationText: { color: '#e2e8f0', fontSize: 18, lineHeight: 26 },
  responsesSection: { gap: 10 },
  responsesTitle: { fontSize: 13, color: '#64748b', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  responseCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 14, flexDirection: 'row', gap: 12, alignItems: 'center' },
  responseTexts: { flex: 1 },
  responseMn: { color: '#fff', fontSize: 17, fontWeight: '600', marginBottom: 4 },
  responseRu: { color: '#94a3b8', fontSize: 13 },
  responseActions: { flexDirection: 'column', gap: 8 },
  speakBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#3b82f6', alignItems: 'center', justifyContent: 'center' },
  speakBtnIcon: { fontSize: 18 },
  showBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#7c3aed', alignItems: 'center', justifyContent: 'center' },
  showBtnIcon: { fontSize: 18 },
  // Fullscreen modal
  fullscreenModal: { flex: 1, backgroundColor: '#fff', justifyContent: 'center', alignItems: 'center' },
  fullscreenClose: { position: 'absolute', top: 56, right: 24, zIndex: 10 },
  fullscreenCloseText: { fontSize: 16, color: '#888', fontWeight: '600' },
  fullscreenContent: { padding: 40, alignItems: 'center', gap: 24, width: '100%' },
  fullscreenMn: { fontSize: 48, fontWeight: '700', color: '#0f172a', textAlign: 'center', lineHeight: 60 },
  fullscreenRu: { fontSize: 22, color: '#64748b', textAlign: 'center' },
  fullscreenSpeak: { backgroundColor: '#3b82f6', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 16, marginTop: 16 },
  fullscreenSpeakText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
