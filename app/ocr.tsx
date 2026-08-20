import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, ScrollView, Image, Platform,
  ActivityIndicator, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from '@/services/api';

type Direction = 'to_ru' | 'to_mn';

export default function OCRScreen() {
  const [image, setImage] = useState<string | null>(null);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [original, setOriginal] = useState('');
  const [translation, setTranslation] = useState('');
  const [loading, setLoading] = useState(false);
  const [direction, setDirection] = useState<Direction>('to_ru');

  const pickImage = async (fromCamera: boolean) => {
    if (Platform.OS !== 'web') {
      const { status } = fromCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Нет доступа', 'Разрешите доступ к ' + (fromCamera ? 'камере' : 'галерее'));
        return;
      }
    }

    const result = fromCamera
      ? await ImagePicker.launchCameraAsync({ base64: true, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ base64: true, quality: 0.7 });

    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      setOriginal('');
      setTranslation('');
      if (asset.base64) {
        await doOCR(asset.base64);
      }
    }
  };

  const doOCR = async (base64: string) => {
    setLoading(true);
    try {
      const to = direction === 'to_ru' ? 'ru' : 'mn';
      const result = await api.ocr(base64, to);
      setOriginal(result.original || '');
      setTranslation(result.translation || '');
    } catch (err) {
      Alert.alert('Ошибка', 'Не удалось распознать текст. Попробуйте снова.');
    } finally {
      setLoading(false);
    }
  };

  const retry = () => {
    if (image) doOCR(image);
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Direction toggle */}
      <View style={styles.directionBar}>
        <Pressable
          style={[styles.dirBtn, direction === 'to_ru' && styles.dirBtnActive]}
          onPress={() => setDirection('to_ru')}
        >
          <Text style={[styles.dirBtnText, direction === 'to_ru' && styles.dirBtnTextActive]}>
            🇲🇳 → 🇷🇺 Монг. → Рус.
          </Text>
        </Pressable>
        <Pressable
          style={[styles.dirBtn, direction === 'to_mn' && styles.dirBtnActive]}
          onPress={() => setDirection('to_mn')}
        >
          <Text style={[styles.dirBtnText, direction === 'to_mn' && styles.dirBtnTextActive]}>
            🇷🇺 → 🇲🇳 Рус. → Монг.
          </Text>
        </Pressable>
      </View>

      {/* Buttons */}
      <View style={styles.btnRow}>
        {Platform.OS !== 'web' && (
          <Pressable style={[styles.pickBtn, styles.pickBtnCamera]} onPress={() => pickImage(true)}>
            <Text style={styles.pickBtnText}>📷 Камера</Text>
          </Pressable>
        )}
        <Pressable style={styles.pickBtn} onPress={() => pickImage(false)}>
          <Text style={styles.pickBtnText}>🖼️ Галерея</Text>
        </Pressable>
      </View>

      {/* Image preview */}
      {imageUri && (
        <View style={styles.imageWrap}>
          <Image source={{ uri: imageUri }} style={styles.preview} resizeMode="contain" />
        </View>
      )}

      {/* Loading */}
      {loading && (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color="#3b82f6" />
          <Text style={styles.loadingText}>Распознаём текст…</Text>
        </View>
      )}

      {/* Results */}
      {!loading && original !== '' && (
        <View style={styles.results}>
          <ResultCard
            label="Оригинал (с изображения)"
            text={original}
            color="#1a1a1a"
            bg="#f8f9fa"
          />
          <ResultCard
            label={direction === 'to_ru' ? 'Перевод на русский' : 'Перевод на монгольский'}
            text={translation}
            color="#15803d"
            bg="#dcfce7"
          />
          <Pressable style={styles.retryBtn} onPress={retry}>
            <Text style={styles.retryBtnText}>🔄 Повторить</Text>
          </Pressable>
        </View>
      )}

      {/* Empty state */}
      {!imageUri && !loading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyTitle}>Сфотографируй текст</Text>
          <Text style={styles.emptySub}>
            Вывески, меню, знаки — нажми «Камера» или выбери из галереи.{'\n'}
            AI распознает текст и переведёт его.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

function ResultCard({ label, text, color, bg }: {
  label: string; text: string; color: string; bg: string;
}) {
  return (
    <View style={[styles.resultCard, { backgroundColor: bg }]}>
      <Text style={styles.resultLabel}>{label}</Text>
      <Text style={[styles.resultText, { color }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  content: { padding: 16, gap: 14 },
  directionBar: { flexDirection: 'row', gap: 8 },
  dirBtn: { flex: 1, padding: 10, borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', backgroundColor: '#fff', alignItems: 'center' },
  dirBtnActive: { backgroundColor: '#3b82f6', borderColor: '#3b82f6' },
  dirBtnText: { fontSize: 13, fontWeight: '600', color: '#555', textAlign: 'center' },
  dirBtnTextActive: { color: '#fff' },
  btnRow: { flexDirection: 'row', gap: 10 },
  pickBtn: { flex: 1, backgroundColor: '#3b82f6', padding: 14, borderRadius: 12, alignItems: 'center' },
  pickBtnCamera: { backgroundColor: '#7c3aed' },
  pickBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  imageWrap: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#000', maxHeight: 260 },
  preview: { width: '100%', height: 260 },
  loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  loadingText: { fontSize: 14, color: '#888' },
  results: { gap: 10 },
  resultCard: { borderRadius: 12, padding: 14 },
  resultLabel: { fontSize: 11, fontWeight: '700', color: '#888', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 },
  resultText: { fontSize: 16, lineHeight: 24 },
  retryBtn: { backgroundColor: '#f5f5f5', borderRadius: 10, padding: 12, alignItems: 'center', borderWidth: 1, borderColor: '#e5e7eb' },
  retryBtnText: { fontSize: 14, fontWeight: '600', color: '#555' },
  emptyState: { alignItems: 'center', paddingVertical: 48, gap: 10 },
  emptyEmoji: { fontSize: 64 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#1a1a1a' },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
});
