import { useEffect, useRef, useState } from 'react';
import {
  StyleSheet, Text, View, Pressable, FlatList, TextInput,
  ActivityIndicator, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams, useFocusEffect, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { api, type ChatMessage, type Conversation } from '@/services/api';

const BRAND = '#015197';

export default function ConversationScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const conversationId = Number(id);
  const { user } = useAuth();
  const tabBarHeight = useBottomTabBarHeight();
  const qc = useQueryClient();
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const conv = qc.getQueryData<Conversation[]>(['conversations'])?.find(c => c.id === conversationId);

  const msgsQ = useQuery({
    queryKey: ['messages', conversationId],
    queryFn: async () => (await api.getMessages(conversationId)).messages,
    enabled: !!conversationId,
  });

  // Mark read on open and whenever we come back to this screen — the
  // conversation list's unread badge is driven by this, refetched via its
  // own focus effect (no live push, see message-routes.js).
  useFocusEffect(() => {
    if (conversationId) api.markConversationRead(conversationId).catch(() => {});
  });

  useEffect(() => {
    if (msgsQ.data?.length) setTimeout(() => listRef.current?.scrollToEnd({ animated: false }), 50);
  }, [msgsQ.data?.length]);

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setText('');
    try {
      await api.sendMessage(conversationId, content);
      await qc.invalidateQueries({ queryKey: ['messages', conversationId] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      setText(content); // give it back so the user doesn't lose what they typed
      Alert.alert('Ошибка', e.message || 'Не удалось отправить сообщение');
    } finally {
      setSending(false);
    }
  };

  const confirmDelete = () => {
    Alert.alert('Удалить переписку?', 'Сообщения будут удалены для обеих сторон.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить', style: 'destructive', onPress: async () => {
          try {
            await api.deleteConversation(conversationId);
            qc.invalidateQueries({ queryKey: ['conversations'] });
            router.back();
          } catch (e: any) {
            Alert.alert('Ошибка', e.message || 'Не удалось удалить');
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <Stack.Screen
        options={{
          title: conv?.otherUserName || 'Сообщения',
          headerRight: () => (
            <Pressable onPress={confirmDelete} hitSlop={10}>
              <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </Pressable>
          ),
        }}
      />

      {msgsQ.isLoading ? (
        <ActivityIndicator color={BRAND} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          ref={listRef}
          data={msgsQ.data || []}
          keyExtractor={m => String(m.id)}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => <MessageBubble message={item} isMine={item.senderId === user?.id} />}
        />
      )}

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
        <View style={[styles.inputRow, { paddingBottom: Math.max(10, tabBarHeight ? 10 : 20) }]}>
          <TextInput
            style={styles.input}
            placeholder="Сообщение…"
            value={text}
            onChangeText={setText}
            multiline
            maxLength={2000}
          />
          <Pressable style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]} onPress={send} disabled={!text.trim() || sending}>
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="arrow-up" size={18} color="#fff" />}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ message, isMine }: { message: ChatMessage; isMine: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={[styles.bubbleWrap, isMine ? styles.bubbleWrapMine : styles.bubbleWrapTheirs]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, isMine && styles.bubbleTextMine]}>{message.content}</Text>
      </View>
      <Text style={styles.bubbleTime}>{time}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F8FAFC' },
  list: { padding: 12, gap: 6 },

  bubbleWrap: { maxWidth: '78%', marginBottom: 4 },
  bubbleWrapMine: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  bubbleWrapTheirs: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 9 },
  bubbleMine: { backgroundColor: BRAND, borderBottomRightRadius: 4 },
  bubbleTheirs: { backgroundColor: '#fff', borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 20, color: '#1E293B' },
  bubbleTextMine: { color: '#fff' },
  bubbleTime: { fontSize: 10, color: '#94A3B8', marginTop: 2, marginHorizontal: 4 },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F1F5F9',
  },
  input: {
    flex: 1, maxHeight: 100, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10, fontSize: 14,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: BRAND,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#CBD5E1' },
});
