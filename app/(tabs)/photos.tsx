import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, FlatList, Image, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, ScrollView,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type MediaPost, type MediaSort } from '@/services/api';

const BRAND = '#015197';
const GAP = 8;
const PAD = 12;

const TABS: { key: MediaSort; label: string }[] = [
  { key: 'recent', label: 'Новые' },
  { key: 'popular', label: 'Популярные' },
  { key: 'top', label: 'Лучшие' },
];

export default function PhotosScreen() {
  const { isAuthenticated } = useAuth();
  const qc = useQueryClient();
  const { width } = useWindowDimensions();
  const tabBarHeight = useBottomTabBarHeight();
  const [sort, setSort] = useState<MediaSort>('recent');
  const [viewer, setViewer] = useState<MediaPost | null>(null);
  const [showUpload, setShowUpload] = useState(false);

  const cardWidth = (Math.min(width, 600) - PAD * 2 - GAP) / 2;

  const postsQ = useQuery({
    queryKey: ['media', 'photo', sort],
    queryFn: () => api.getMedia('photo', sort, 1),
  });
  const awardsQ = useQuery({ queryKey: ['media-awards', 'photo'], queryFn: () => api.getMediaAwards('photo') });

  const requireAuth = (action: () => void) => {
    if (!isAuthenticated) { router.push('/(auth)/login' as any); return; }
    action();
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>📸 Фото</Text>
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

      {!!awardsQ.data?.awards.length && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.awardsBar} contentContainerStyle={styles.awardsContent}>
          {awardsQ.data.awards.map(a => (
            <View key={a.id} style={styles.awardChip}>
              <Text style={styles.awardEmoji}>🏆</Text>
              <Text style={styles.awardTitle} numberOfLines={1}>{a.award_title || a.title}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      {postsQ.isLoading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={BRAND} /></View>
      ) : !postsQ.data?.posts.length ? (
        <View style={styles.center}>
          <Text style={styles.emptyEmoji}>📷</Text>
          <Text style={styles.emptyTitle}>Пока нет фото</Text>
          <Text style={styles.emptySub}>Будьте первым — поделитесь снимком Монголии</Text>
        </View>
      ) : (
        <FlatList
          data={postsQ.data.posts}
          keyExtractor={p => String(p.id)}
          numColumns={2}
          contentContainerStyle={[styles.grid, { paddingBottom: tabBarHeight + 16 }]}
          columnWrapperStyle={{ gap: GAP }}
          refreshing={postsQ.isRefetching}
          onRefresh={postsQ.refetch}
          renderItem={({ item }) => (
            <Pressable style={[styles.card, { width: cardWidth }]} onPress={() => setViewer(item)}>
              {item.media_data && <Image source={{ uri: item.media_data }} style={[styles.thumb, { width: cardWidth, height: cardWidth }]} />}
              <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
              <View style={styles.cardMeta}>
                <Ionicons name={item.user_liked ? 'heart' : 'heart-outline'} size={13} color={item.user_liked ? '#EF4444' : '#94A3B8'} />
                <Text style={styles.cardMetaText}>{item.like_count}</Text>
                {item.avg_rating != null && (
                  <>
                    <Ionicons name="star" size={12} color="#F59E0B" style={{ marginLeft: 8 }} />
                    <Text style={styles.cardMetaText}>{item.avg_rating}</Text>
                  </>
                )}
              </View>
            </Pressable>
          )}
        />
      )}

      {viewer && (
        <PhotoViewer post={viewer} onClose={() => setViewer(null)} onRequireAuth={() => requireAuth(() => {})} />
      )}
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={() => { setShowUpload(false); qc.invalidateQueries({ queryKey: ['media', 'photo'] }); }}
        />
      )}
    </SafeAreaView>
  );
}

function PhotoViewer({ post, onClose, onRequireAuth }: { post: MediaPost; onClose: () => void; onRequireAuth: () => void }) {
  const { isAuthenticated, user } = useAuth();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(!!post.user_liked);
  const [likeCount, setLikeCount] = useState(post.like_count);
  const [myRating, setMyRating] = useState(post.user_rating || 0);
  const [avgRating, setAvgRating] = useState(post.avg_rating);

  const toggleLike = async () => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    setLiked(v => !v);
    setLikeCount(c => c + (liked ? -1 : 1));
    try { await api.likeMedia(post.id); } catch {}
  };

  const rate = async (n: number) => {
    if (!isAuthenticated) { onRequireAuth(); return; }
    setMyRating(n);
    try {
      const res = await api.rateMedia(post.id, n);
      setAvgRating(res.avgRating);
    } catch {}
  };

  const author = [post.first_name, post.last_name].filter(Boolean).join(' ') || 'Аноним';
  const isOwner = user && String(user.id) === String(post.user_id);

  const remove = () => {
    Alert.alert('Удалить фото?', '', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive',
        onPress: async () => {
          try {
            await api.deleteMedia(post.id, 'other');
            qc.invalidateQueries({ queryKey: ['media', 'photo'] });
            onClose();
          } catch (e: any) { Alert.alert('Ошибка', e.message); }
        },
      },
    ]);
  };

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.viewerBackdrop}>
        <Pressable style={styles.viewerClose} onPress={onClose} hitSlop={12}>
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        {post.media_data && <Image source={{ uri: post.media_data }} style={styles.viewerImage} resizeMode="contain" />}
        <View style={styles.viewerInfo}>
          <Text style={styles.viewerTitle}>{post.title}</Text>
          {!!post.description && <Text style={styles.viewerDesc}>{post.description}</Text>}
          <Text style={styles.viewerAuthor}>👤 {author}</Text>
          <View style={styles.viewerActions}>
            <Pressable style={styles.viewerActionBtn} onPress={toggleLike}>
              <Ionicons name={liked ? 'heart' : 'heart-outline'} size={20} color={liked ? '#EF4444' : '#fff'} />
              <Text style={styles.viewerActionText}>{likeCount}</Text>
            </Pressable>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <Pressable key={n} onPress={() => rate(n)} hitSlop={4}>
                  <Ionicons name={n <= myRating ? 'star' : 'star-outline'} size={18} color="#F59E0B" />
                </Pressable>
              ))}
              {avgRating != null && <Text style={styles.viewerActionText}>  {avgRating}</Text>}
            </View>
            {isOwner && (
              <Pressable style={styles.viewerActionBtn} onPress={remove}>
                <Ionicons name="trash-outline" size={20} color="#fff" />
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function UploadModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [uri, setUri] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const pick = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Нет доступа', 'Разрешите доступ к галерее'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
    });
    if (result.canceled || !result.assets[0]) return;
    // Downscale + JPEG-compress before base64 — keeps the row well under a
    // MB (media_data is a plain Postgres TEXT column, not a blob store).
    const manipulated = await ImageManipulator.manipulateAsync(
      result.assets[0].uri,
      [{ resize: { width: 1280 } }],
      { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    );
    setUri(`data:image/jpeg;base64,${manipulated.base64}`);
  };

  const submit = async () => {
    if (!uri || title.trim().length < 2 || submitting) return;
    setSubmitting(true);
    try {
      await api.createMedia({ type: 'photo', title: title.trim(), description: description.trim() || undefined, mediaData: uri });
      onDone();
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось загрузить');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={styles.modalTitle}>Новое фото</Text>
            <Pressable hitSlop={10} onPress={onClose}><Ionicons name="close" size={22} color="#94A3B8" /></Pressable>
          </View>

          <Pressable style={styles.pickBox} onPress={pick}>
            {uri ? <Image source={{ uri }} style={styles.pickPreview} /> : (
              <>
                <Ionicons name="image-outline" size={32} color="#94A3B8" />
                <Text style={styles.pickBoxText}>Выбрать фото</Text>
              </>
            )}
          </Pressable>

          <TextInput style={styles.input} value={title} onChangeText={setTitle} placeholder="Название" placeholderTextColor="#94A3B8" maxLength={80} />
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={description}
            onChangeText={setDescription}
            placeholder="Описание (необязательно)"
            placeholderTextColor="#94A3B8"
            multiline
            maxLength={300}
          />

          <Pressable
            style={[styles.submitBtn, (!uri || title.trim().length < 2 || submitting) && styles.submitBtnDisabled]}
            onPress={submit}
            disabled={!uri || title.trim().length < 2 || submitting}
          >
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

  awardsBar: { maxHeight: 40, marginBottom: 8 },
  awardsContent: { paddingHorizontal: 16, gap: 8 },
  awardChip: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FEF3C7', borderRadius: 14, paddingHorizontal: 11, paddingVertical: 6, maxWidth: 180 },
  awardEmoji: { fontSize: 13 },
  awardTitle: { fontSize: 12, fontWeight: '700', color: '#92400E' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  emptyEmoji: { fontSize: 44 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1E293B' },
  emptySub: { fontSize: 13, color: '#94A3B8', textAlign: 'center' },

  grid: { paddingHorizontal: PAD, paddingBottom: 24, gap: GAP },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', marginBottom: GAP },
  thumb: { backgroundColor: '#E2E8F0' },
  cardTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', paddingHorizontal: 8, paddingTop: 6 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, gap: 3 },
  cardMetaText: { fontSize: 11, color: '#64748B', fontWeight: '600' },

  viewerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)' },
  viewerClose: { position: 'absolute', top: 50, right: 16, zIndex: 2 },
  viewerImage: { flex: 1, width: '100%' },
  viewerInfo: { padding: 16, paddingBottom: 32 },
  viewerTitle: { color: '#fff', fontSize: 17, fontWeight: '700' },
  viewerDesc: { color: '#CBD5E1', fontSize: 13, marginTop: 4 },
  viewerAuthor: { color: '#94A3B8', fontSize: 12, marginTop: 8 },
  viewerActions: { flexDirection: 'row', alignItems: 'center', gap: 20, marginTop: 14 },
  viewerActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewerActionText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(15,23,42,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  pickBox: { height: 160, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginBottom: 12, overflow: 'hidden', backgroundColor: '#F8FAFC' },
  pickBoxText: { fontSize: 13, color: '#94A3B8', marginTop: 6 },
  pickPreview: { width: '100%', height: '100%' },
  input: { backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1E293B', marginBottom: 10 },
  inputMultiline: { minHeight: 70, textAlignVertical: 'top' },
  submitBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 4 },
  submitBtnDisabled: { backgroundColor: '#94A3B8' },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
