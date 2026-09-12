import { useState } from 'react';
import { StyleSheet, Text, View, Pressable, FlatList, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type WelcomeVideo } from '@/services/api';

// Same cap as videos.tsx's community-video upload — comfortably under the
// server's 60MB base64 request limit (base64 inflates size ~33%).
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

const BRAND = '#015197';

const SEASONS: { key: WelcomeVideo['season']; label: string; emoji: string }[] = [
  { key: 'winter', label: 'Зима', emoji: '❄️' },
  { key: 'spring', label: 'Весна', emoji: '🌸' },
  { key: 'summer', label: 'Лето', emoji: '☀️' },
  { key: 'autumn', label: 'Осень', emoji: '🍂' },
  { key: 'any', label: 'Без сезона', emoji: '🎬' },
];

const PRIVILEGED = ['admin', 'superadmin', 'moderator'];

// Admin-only screen for the small set of trusted roles that can manage the
// welcome-screen carousel — no dedicated tab, reached only from Settings'
// menu when the signed-in user's role qualifies. RU-only, matching the
// existing precedent for admin/internal tooling in this app (ads.tsx,
// transport.tsx) — not every screen needs i18n.
export default function AdminWelcomeVideosScreen() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [season, setSeason] = useState<WelcomeVideo['season']>('any');
  const [uploading, setUploading] = useState(false);

  const videosQ = useQuery({ queryKey: ['welcome-videos-admin'], queryFn: () => api.getWelcomeVideos() });
  const videos = videosQ.data?.videos || [];

  const isPrivileged = !!user && PRIVILEGED.includes(user.role);

  const pickAndUpload = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нет доступа', 'Разрешите доступ к галерее'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      Alert.alert('Слишком большой файл', `Максимум ${MAX_VIDEO_BYTES / 1024 / 1024} МБ — заранее обрежьте ролик.`);
      return;
    }

    setUploading(true);
    try {
      const base64 = await new File(asset.uri).base64();
      const ext = asset.uri.toLowerCase().endsWith('.mov') ? 'quicktime' : 'mp4';
      await api.createWelcomeVideo({ season, mediaData: `data:video/${ext};base64,${base64}` });
      qc.invalidateQueries({ queryKey: ['welcome-videos-admin'] });
      qc.invalidateQueries({ queryKey: ['welcome-videos'] });
    } catch (e: any) {
      Alert.alert('Ошибка загрузки', e.message || 'Не удалось загрузить ролик');
    } finally {
      setUploading(false);
    }
  };

  const confirmDelete = (video: WelcomeVideo) => {
    Alert.alert('Удалить ролик?', 'Пропадёт из карусели приветствия.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            await api.deleteWelcomeVideo(video.id);
            qc.invalidateQueries({ queryKey: ['welcome-videos-admin'] });
            qc.invalidateQueries({ queryKey: ['welcome-videos'] });
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  if (!isPrivileged) {
    return (
      <SafeAreaView style={styles.screen}>
        <Stack.Screen options={{ title: 'Приветствие' }} />
        <View style={styles.center}>
          <Ionicons name="lock-closed-outline" size={32} color="#94A3B8" />
          <Text style={styles.noAccessText}>Нет доступа</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen options={{ title: 'Видео приветствия' }} />

      <View style={styles.seasonRow}>
        {SEASONS.map(s => (
          <Pressable
            key={s.key}
            style={[styles.seasonChip, season === s.key && styles.seasonChipActive]}
            onPress={() => setSeason(s.key)}
          >
            <Text style={styles.seasonChipText}>{s.emoji} {s.label}</Text>
          </Pressable>
        ))}
      </View>

      <Pressable style={styles.uploadBtn} onPress={pickAndUpload} disabled={uploading}>
        {uploading ? (
          <ActivityIndicator color="#fff" size="small" />
        ) : (
          <Ionicons name="videocam-outline" size={18} color="#fff" />
        )}
        <Text style={styles.uploadBtnText}>
          {uploading ? 'Загрузка…' : `Добавить ролик из галереи (${SEASONS.find(s => s.key === season)?.label})`}
        </Text>
      </Pressable>

      {videosQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={videos}
          keyExtractor={v => String(v.id)}
          contentContainerStyle={styles.list}
          ListEmptyComponent={<Text style={styles.emptyText}>Роликов пока нет</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Ionicons name="film-outline" size={20} color={BRAND} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowSeason}>{SEASONS.find(s => s.key === item.season)?.label || item.season}</Text>
                <Text style={styles.rowUrl} numberOfLines={1}>{item.url}</Text>
              </View>
              <Pressable onPress={() => confirmDelete(item)} hitSlop={10}>
                <Ionicons name="trash-outline" size={18} color="#EF4444" />
              </Pressable>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  noAccessText: { fontSize: 14, color: '#94A3B8', fontWeight: '600' },

  seasonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 16, paddingBottom: 4 },
  seasonChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  seasonChipActive: { backgroundColor: BRAND, borderColor: BRAND },
  seasonChipText: { fontSize: 13, fontWeight: '600', color: '#334155' },

  uploadBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 8, marginBottom: 16, height: 48, borderRadius: 14, backgroundColor: BRAND,
  },
  uploadBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

  list: { paddingHorizontal: 16, paddingBottom: 32, gap: 8 },
  emptyText: { textAlign: 'center', color: '#94A3B8', fontSize: 13, marginTop: 24 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#F1F5F9',
  },
  rowSeason: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  rowUrl: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
});
