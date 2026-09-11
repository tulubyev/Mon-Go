import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, FlatList, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type MediaPost, type MediaSort } from '@/services/api';

// 40MB raw file — comfortably under the server's 60MB base64 request cap
// (base64 inflates size ~33%) and enough for a short clip. Longer video
// should go through the link field instead (no upload, no S3 needed).
const MAX_VIDEO_BYTES = 40 * 1024 * 1024;

const BRAND = '#015197';

const TABS: { key: MediaSort; label: string }[] = [
  { key: 'recent', label: 'Новые' },
  { key: 'popular', label: 'Популярные' },
  { key: 'top', label: 'Лучшие' },
];

export default function VideosScreen() {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [sort, setSort] = useState<MediaSort>('recent');
  const [showUpload, setShowUpload] = useState(false);

  const postsQ = useQuery({ queryKey: ['media', 'video', sort], queryFn: () => api.getMedia('video', sort, 1) });

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) { router.push('/(auth)/login' as any); return; }
    action();
  };

  const like = async (post: MediaPost) => {
    if (!isAuthenticated) { requireAuth(() => {}); return; }
    try { await api.likeMedia(post.id); qc.invalidateQueries({ queryKey: ['media', 'video', sort] }); } catch {}
  };

  const remove = (post: MediaPost) => {
    Alert.alert('Удалить видео?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          try { await api.deleteMedia(post.id, 'other'); qc.invalidateQueries({ queryKey: ['media', 'video'] }); }
          catch (e: any) { Alert.alert('Ошибка', e.message); }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🎬 Видео</Text>
        <Pressable style={styles.uploadBtn} onPress={() => requireAuth(() => setShowUpload(true))}>
          <Ionicons name="add" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.tabs}>
        {TABS.map(tab => (
          <Pressable key={tab.key} style={[styles.tab, sort === tab.key && styles.tabActive]} onPress={() => setSort(tab.key)}>
            <Text style={[styles.tabText, sort === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </Pressable>
        ))}
      </View>

      {postsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : !postsQ.data?.posts.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>🎥</Text>
          <Text style={styles.emptyTitle}>Пока нет видео</Text>
          <Text style={styles.emptySub}>Поделитесь ссылкой на ролик о Монголии</Text>
        </View>
      ) : (
        <FlatList
          data={postsQ.data.posts}
          keyExtractor={p => String(p.id)}
          contentContainerStyle={styles.list}
          refreshing={postsQ.isRefetching}
          onRefresh={postsQ.refetch}
          renderItem={({ item }) => {
            const author = [item.first_name, item.last_name].filter(Boolean).join(' ') || 'Аноним';
            const isOwner = user && String(user.id) === String(item.user_id);
            return (
              <View style={styles.card}>
                <View style={styles.cardTop}>
                  <View style={styles.playBadge}><Ionicons name="play" size={18} color="#fff" /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cardTitle} numberOfLines={2}>{item.title}</Text>
                    <Text style={styles.cardAuthor}>👤 {author}</Text>
                  </View>
                </View>
                {!!item.description && <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>}
                <View style={styles.cardActions}>
                  <Pressable style={styles.openBtn} onPress={() => item.media_url && Linking.openURL(item.media_url)}>
                    <Ionicons name="open-outline" size={15} color="#fff" />
                    <Text style={styles.openBtnText}>Смотреть</Text>
                  </Pressable>
                  <Pressable style={styles.likeBtn} onPress={() => like(item)}>
                    <Ionicons name={item.user_liked ? 'heart' : 'heart-outline'} size={16} color={item.user_liked ? '#EF4444' : '#64748B'} />
                    <Text style={styles.likeText}>{item.like_count}</Text>
                  </Pressable>
                  {isOwner && (
                    <Pressable hitSlop={8} onPress={() => remove(item)}>
                      <Ionicons name="trash-outline" size={16} color="#EF4444" />
                    </Pressable>
                  )}
                </View>
              </View>
            );
          }}
        />
      )}

      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['media', 'video'] }); }}
        />
      )}
    </SafeAreaView>
  );
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'link' | 'file'>('link');
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [pickedName, setPickedName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = title.trim().length >= 2 && (mode === 'link' ? /^https?:\/\//.test(url.trim()) : !!pickedUri);

  const pickFile = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нет доступа', 'Разрешите доступ к галерее'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Videos });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    if (asset.fileSize && asset.fileSize > MAX_VIDEO_BYTES) {
      Alert.alert('Слишком большой файл', `Максимум ${MAX_VIDEO_BYTES / 1024 / 1024} МБ — для длинных роликов используйте ссылку.`);
      return;
    }
    setPickedUri(asset.uri);
    setPickedName(asset.fileName || asset.uri.split('/').pop() || 'video.mp4');
  };

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setSubmitting(true);
    try {
      if (mode === 'link') {
        await api.createMedia({ type: 'video', title: title.trim(), description: description.trim() || undefined, mediaUrl: url.trim() });
      } else if (pickedUri) {
        const base64 = await new File(pickedUri).base64();
        const ext = (pickedName || '').toLowerCase().endsWith('.mov') ? 'quicktime' : 'mp4';
        await api.createMedia({
          type: 'video',
          title: title.trim(),
          description: description.trim() || undefined,
          mediaData: `data:video/${ext};base64,${base64}`,
        });
      }
      onDone();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось опубликовать');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Новое видео</Text>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>

          <View style={styles.modeRow}>
            <Pressable style={[styles.modeBtn, mode === 'link' && styles.modeBtnActive]} onPress={() => setMode('link')}>
              <Text style={[styles.modeBtnText, mode === 'link' && styles.modeBtnTextActive]}>Ссылка</Text>
            </Pressable>
            <Pressable style={[styles.modeBtn, mode === 'file' && styles.modeBtnActive]} onPress={() => setMode('file')}>
              <Text style={[styles.modeBtnText, mode === 'file' && styles.modeBtnTextActive]}>Файл</Text>
            </Pressable>
          </View>

          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название" placeholderTextColor="#94A3B8" maxLength={80} />

          {mode === 'link' ? (
            <TextInput
              style={styles.input}
              value={url}
              onChangeText={setUrl}
              placeholder="Ссылка на видео (YouTube, VK, Rutube…)"
              placeholderTextColor="#94A3B8"
              autoCapitalize="none"
              keyboardType="url"
            />
          ) : (
            <Pressable style={styles.pickBox} onPress={pickFile}>
              <Ionicons name={pickedUri ? 'checkmark-circle' : 'videocam-outline'} size={28} color={pickedUri ? '#10B981' : '#94A3B8'} />
              <Text style={styles.pickBoxText} numberOfLines={1}>{pickedName || 'Выбрать видео из галереи'}</Text>
            </Pressable>
          )}

          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Описание (необязательно)"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={300}
          />

          <Pressable style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={submit} disabled={!canSubmit || submitting}>
            {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Опубликовать</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  uploadBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 8 },
  tab: { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E2E8F0' },
  tabActive: { backgroundColor: BRAND, borderColor: BRAND },
  tabText: { fontSize: 13, fontWeight: '600', color: '#475569' },
  tabTextActive: { color: '#fff' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  list: { padding: 16, gap: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, gap: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  playBadge: { width: 40, height: 40, borderRadius: 10, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  cardAuthor: { fontSize: 12, color: '#94A3B8', marginTop: 2 },
  cardDesc: { fontSize: 13, color: '#64748B', lineHeight: 18 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  openBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: BRAND, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10 },
  openBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  likeBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  likeText: { fontSize: 12, fontWeight: '600', color: '#64748B' },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  modeRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  modeBtn: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10, backgroundColor: '#F1F5F9' },
  modeBtnActive: { backgroundColor: BRAND },
  modeBtnText: { fontSize: 13, fontWeight: '700', color: '#475569' },
  modeBtnTextActive: { color: '#fff' },
  pickBox: { height: 64, borderRadius: 10, borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 10, paddingHorizontal: 12, backgroundColor: '#F8FAFC' },
  pickBoxText: { fontSize: 13, color: '#475569', flexShrink: 1 },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', marginBottom: 10 },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
