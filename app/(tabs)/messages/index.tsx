import { useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, FlatList, Modal, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type Conversation, type UserSearchResult } from '@/services/api';

const BRAND = '#015197';

// No WebSocket push in this first pass (see TMB's message-routes.js) — the
// list refetches on screen focus instead, same "good enough without a live
// connection" tradeoff the rest of this app makes for Mongolia's patchy
// mobile coverage.
export default function MessagesScreen() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [newChatOpen, setNewChatOpen] = useState(false);

  const convQ = useQuery({
    queryKey: ['conversations'],
    queryFn: async () => (await api.getConversations()).conversations,
    enabled: isAuthenticated,
  });

  useFocusEffect(() => {
    if (isAuthenticated) qc.invalidateQueries({ queryKey: ['conversations'] });
  });

  if (authLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.screen} edges={['top']}>
        <View style={styles.center}>
          <Ionicons name="chatbubbles-outline" size={40} color="#94A3B8" />
          <Text style={styles.emptyTitle}>Нужен вход</Text>
          <Text style={styles.emptyText}>Сообщения доступны только зарегистрированным пользователям</Text>
          <Pressable style={styles.loginBtn} onPress={() => router.push('/login' as any)}>
            <Text style={styles.loginBtnText}>Войти</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const conversations = convQ.data || [];

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Сообщения</Text>
        <Pressable style={styles.newChatBtn} onPress={() => setNewChatOpen(true)}>
          <Ionicons name="create-outline" size={20} color="#fff" />
        </Pressable>
      </View>

      {convQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={conversations}
          keyExtractor={c => String(c.id)}
          contentContainerStyle={[styles.list, { paddingBottom: tabBarHeight + 16 }]}
          refreshing={convQ.isFetching}
          onRefresh={() => qc.invalidateQueries({ queryKey: ['conversations'] })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={40} color="#CBD5E1" />
              <Text style={styles.emptyText}>Пока нет переписок — нажмите ✏️, чтобы написать кому-нибудь</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable style={styles.row} onPress={() => router.push(`/messages/${item.id}` as any)}>
              <Avatar name={item.otherUserName} url={item.otherUserAvatar} />
              <View style={{ flex: 1 }}>
                <Text style={styles.rowName} numberOfLines={1}>{item.otherUserName}</Text>
                <Text style={[styles.rowPreview, item.unreadCount > 0 && styles.rowPreviewUnread]} numberOfLines={1}>
                  {item.lastMessage || 'Нет сообщений'}
                </Text>
              </View>
              {item.unreadCount > 0 && (
                <View style={styles.unreadBadge}>
                  <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
                </View>
              )}
            </Pressable>
          )}
        />
      )}

      {newChatOpen && <NewChatModal onClose={() => setNewChatOpen(false)} />}
    </SafeAreaView>
  );
}

function Avatar({ name, url }: { name: string; url: string | null }) {
  const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?';
  if (url) return <Image source={{ uri: url }} style={styles.avatar} />;
  return <View style={styles.avatar}><Text style={styles.avatarText}>{initials}</Text></View>;
}

function NewChatModal({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<number | null>(null);

  const search = async (q: string) => {
    setQuery(q);
    if (q.trim().length < 2) { setResults([]); return; }
    setSearching(true);
    try {
      const { users } = await api.searchUsers(q.trim());
      setResults(users);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  };

  const openChat = async (user: UserSearchResult) => {
    setStarting(user.id);
    try {
      const { conversation } = await api.startConversation(user.id);
      onClose();
      router.push(`/messages/${conversation.id}` as any);
    } catch (e: any) {
      Alert.alert('Ошибка', e.message || 'Не удалось начать переписку');
    } finally {
      setStarting(null);
    }
  };

  return (
    <Modal transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.modalWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Новое сообщение</Text>
            <Pressable onPress={onClose}><Ionicons name="close" size={22} color="#64748B" /></Pressable>
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder="Имя или email…"
            value={query}
            onChangeText={search}
            autoFocus
          />
          {searching && <ActivityIndicator color={BRAND} style={{ marginTop: 16 }} />}
          <FlatList
            data={results}
            keyExtractor={u => String(u.id)}
            style={{ marginTop: 8 }}
            ListEmptyComponent={
              !searching && query.trim().length >= 2 ? (
                <Text style={styles.emptyText}>Никого не нашли</Text>
              ) : null
            }
            renderItem={({ item }) => (
              <Pressable
                style={styles.userRow}
                disabled={starting !== null}
                onPress={() => openChat(item)}
              >
                <Avatar name={[item.first_name, item.last_name].filter(Boolean).join(' ') || 'Пользователь'} url={item.avatar_url} />
                <Text style={styles.userRowName}>{[item.first_name, item.last_name].filter(Boolean).join(' ') || 'Пользователь'}</Text>
                {starting === item.id && <ActivityIndicator size="small" color={BRAND} />}
              </Pressable>
            )}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  newChatBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: BRAND, alignItems: 'center', justifyContent: 'center' },

  center: { alignItems: 'center', justifyContent: 'center', padding: 32, gap: 8, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: '#334155' },
  emptyText: { fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 19 },
  loginBtn: { marginTop: 12, backgroundColor: BRAND, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  loginBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  list: { paddingHorizontal: 12, gap: 4 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 6,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  rowName: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  rowPreview: { fontSize: 13, color: '#94A3B8', marginTop: 2 },
  rowPreviewUnread: { color: '#1E293B', fontWeight: '600' },
  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },

  modalWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '75%' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#1E293B' },
  searchInput: {
    borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 10, fontSize: 14,
  },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  userRowName: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' },
});
