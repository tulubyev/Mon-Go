import {
  StyleSheet, FlatList, TextInput, Pressable, Text, View,
  KeyboardAvoidingView, Platform, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const USER_ID = 'mobile_' + Math.random().toString(36).slice(2, 10);

export default function ChatScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ question?: string; label?: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const send = useCallback(async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: Date.now().toString(), role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    try {
      const data = await api.ask(text.trim(), USER_ID);
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: data.response || 'Нет ответа',
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: 'Ошибка соединения. Проверьте интернет.',
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    if (params.question) {
      send(params.question);
    }
  }, [params.question]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>AI Чат о Монголии</Text>
            <Text style={styles.emptySub}>Спрашивайте о транспорте, жилье, языке, безопасности и всём остальном</Text>
            <Pressable style={styles.interpreterBtn} onPress={() => router.push('/interpreter')}>
              <Text style={styles.interpreterBtnText}>🎙️ Живой переводчик</Text>
            </Pressable>
          </View>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.userText]}>
                {item.text}
              </Text>
            </View>
          )}
        />
        {loading && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.typingText}>Отвечает...</Text>
          </View>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder="Задайте вопрос о Монголии..."
            placeholderTextColor="#aaa"
            multiline
            onSubmitEditing={() => send(input)}
          />
          <Pressable
            style={({ pressed }) => [styles.sendBtn, pressed && styles.sendBtnPressed, !input.trim() && styles.sendBtnDisabled]}
            onPress={() => send(input)}
            disabled={!input.trim() || loading}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  flex: { flex: 1 },
  list: { padding: 12, gap: 8, flexGrow: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 10 },
  interpreterBtn: { marginTop: 8, backgroundColor: '#0f172a', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 14 },
  interpreterBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  emptyEmoji: { fontSize: 48 },
  emptyTitle: { fontSize: 18, fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, color: '#888', textAlign: 'center', lineHeight: 20 },
  bubble: {
    maxWidth: '80%',
    padding: 12,
    borderRadius: 16,
    backgroundColor: '#f0f4ff',
    alignSelf: 'flex-start',
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderBottomRightRadius: 4,
  },
  botBubble: { borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 22, color: '#333' },
  userText: { color: '#fff' },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 6 },
  typingText: { fontSize: 13, color: '#888' },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 10,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 15,
    color: '#333',
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnPressed: { backgroundColor: '#2563eb' },
  sendBtnDisabled: { backgroundColor: '#c7d9f5' },
  sendIcon: { color: '#fff', fontSize: 20, fontWeight: '700' },
});
