import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { SPACING, FONTS, RADIUS } from '../../src/constants/theme';
import { useTheme } from '../../src/contexts/ThemeContext';
import { useAuthStore } from '../../src/store/authStore';
import api from '../../src/services/api';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'support';
  created_at: string;
}

export default function ChatScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { t } = useTranslation();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await api.get('/chat/messages');
      if (res.data && Array.isArray(res.data)) {
        setMessages(res.data);
      }
    } catch (error) {
      // Start with greeting if no messages
      setMessages([{
        id: 'greeting',
        text: t('supportGreeting'),
        sender: 'support',
        created_at: new Date().toISOString(),
      }]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');

    const tempMsg: Message = {
      id: `temp-${Date.now()}`,
      text,
      sender: 'user',
      created_at: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempMsg]);
    setSending(true);

    try {
      const res = await api.post('/chat/messages', { text });
      if (res.data?.message) {
        setMessages(prev => [
          ...prev.filter(m => m.id !== tempMsg.id),
          res.data.message,
          ...(res.data.reply ? [res.data.reply] : []),
        ]);
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return (
      <View style={[styles.msgRow, isUser && styles.msgRowUser]}>
        {!isUser && (
          <View style={[styles.supportAvatar, { backgroundColor: colors.primary + '20' }]}>
            <Ionicons name="headset" size={16} color={colors.primary} />
          </View>
        )}
        <View
          style={[
            styles.msgBubble,
            isUser
              ? { backgroundColor: colors.primary, borderBottomRightRadius: 4 }
              : { backgroundColor: colors.card, borderBottomLeftRadius: 4, borderWidth: 1, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.msgText, { color: isUser ? '#fff' : colors.text }]}>{item.text}</Text>
          <Text style={[styles.msgTime, { color: isUser ? 'rgba(255,255,255,0.6)' : colors.textMuted }]}>
            {new Date(item.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <View style={styles.headerInfo}>
          <Text style={[styles.headerTitle, { color: colors.text }]}>{t('chatSupport')}</Text>
          <Text style={[styles.headerSub, { color: colors.success }]}>Online</Text>
        </View>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.flex}
        keyboardVerticalOffset={0}
      >
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : messages.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="chatbubbles-outline" size={64} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>{t('noMessages')}</Text>
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
          />
        )}

        {/* Input Bar */}
        <View style={[styles.inputBar, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
          <TextInput
            style={[styles.textInput, { color: colors.text, backgroundColor: colors.surface }]}
            placeholder={t('typeMessage')}
            placeholderTextColor={colors.textMuted}
            value={input}
            onChangeText={setInput}
            onSubmitEditing={handleSend}
            returnKeyType="send"
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, { backgroundColor: input.trim() ? colors.primary : colors.surface }]}
            onPress={handleSend}
            disabled={!input.trim() || sending}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={20} color={input.trim() ? '#fff' : colors.textMuted} />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    gap: SPACING.sm,
  },
  backBtn: { padding: SPACING.xs },
  headerInfo: { flex: 1 },
  headerTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700' },
  headerSub: { fontSize: FONTS.sizes.xs, fontWeight: '600', marginTop: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.md },
  messagesList: { padding: SPACING.md, paddingBottom: SPACING.sm },
  msgRow: { flexDirection: 'row', marginBottom: SPACING.sm, alignItems: 'flex-end' },
  msgRowUser: { justifyContent: 'flex-end' },
  supportAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: SPACING.xs },
  msgBubble: { maxWidth: '75%', paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, borderRadius: RADIUS.lg },
  msgText: { fontSize: FONTS.sizes.md, lineHeight: 20 },
  msgTime: { fontSize: 10, marginTop: 4, alignSelf: 'flex-end' },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    gap: SPACING.xs,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 100,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: FONTS.sizes.md,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
