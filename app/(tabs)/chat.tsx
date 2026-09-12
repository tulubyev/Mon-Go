import {
  StyleSheet, FlatList, TextInput, Pressable, Text, View,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '@/services/api';
import { OfflineBanner } from '@/components/OfflineBanner';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

const USER_ID = 'mobile_' + Math.random().toString(36).slice(2, 10);

export default function ChatScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const params = useLocalSearchParams<{ question?: string; label?: string }>();
  const tabBarHeight = useBottomTabBarHeight();
  const [messages, setMessages] = useState<Message[]>([]);
  const [ratings, setRatings] = useState<Record<string, 'up' | 'down'>>({});
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<FlatList>(null);

  const rate = useCallback(async (messageId: string, rating: 'up' | 'down') => {
    if (ratings[messageId]) return;
    setRatings(prev => ({ ...prev, [messageId]: rating }));
    try { await api.feedback(messageId, rating); } catch { /* silent */ }
  }, [ratings]);

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
        text: data.response || t('chat.noResponse'),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch {
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        text: t('chat.connectionError'),
      }]);
    } finally {
      setLoading(false);
    }
  }, [loading, t]);

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
      <OfflineBanner />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={90}
      >
        {messages.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyEmoji}>💬</Text>
            <Text style={styles.emptyTitle}>{t('chat.about')}</Text>
            <Text style={styles.emptySub}>{t('chat.sub')}</Text>
            <Pressable style={styles.interpreterBtn} onPress={() => router.push('/interpreter')}>
              <Text style={styles.interpreterBtnText}>🎙️ {t('interpreter.title')}</Text>
            </Pressable>
          </View>
        )}
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <View style={styles.messageGroup}>
              <View style={[styles.bubble, item.role === 'user' ? styles.userBubble : styles.botBubble]}>
                <Text
                  style={[styles.bubbleText, item.role === 'user' && styles.userText]}
                  selectable
                  dataDetectorType="phoneNumber"
                >
                  {item.text}
                </Text>
              </View>
              {item.role === 'assistant' && (
                <View style={styles.feedbackRow}>
                  <Pressable
                    style={[styles.feedbackBtn, ratings[item.id] === 'up' && styles.feedbackBtnActive]}
                    onPress={() => rate(item.id, 'up')}
                    disabled={!!ratings[item.id]}
                  >
                    <Text style={styles.feedbackIcon}>👍</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.feedbackBtn, ratings[item.id] === 'down' && styles.feedbackBtnActiveDown]}
                    onPress={() => rate(item.id, 'down')}
                    disabled={!!ratings[item.id]}
                  >
                    <Text style={styles.feedbackIcon}>👎</Text>
                  </Pressable>
                </View>
              )}
            </View>
          )}
        />
        {loading && (
          <View style={styles.typing}>
            <ActivityIndicator size="small" color="#3b82f6" />
            <Text style={styles.typingText}>{t('chat.typing')}</Text>
          </View>
        )}
        <View style={[styles.inputRow, { paddingBottom: 10 + tabBarHeight }]}>
          <TextInput
            style={styles.input}
            value={input}
            onChangeText={setInput}
            placeholder={t('chat.placeholder')}
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
    // Absolute cap, not '80%' — on iPad's ~1024pt width that would read as an
    // ~800px-wide chat bubble. 320 stays comfortable to read at any width.
    maxWidth: 320,
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
  messageGroup: { gap: 2 },
  feedbackRow: { flexDirection: 'row', gap: 4, paddingLeft: 4 },
  feedbackBtn: { padding: 4, borderRadius: 8, opacity: 0.5 },
  feedbackBtnActive: { opacity: 1, backgroundColor: '#dcfce7' },
  feedbackBtnActiveDown: { opacity: 1, backgroundColor: '#fee2e2' },
  feedbackIcon: { fontSize: 15 },
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
