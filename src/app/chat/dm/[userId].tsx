/**
 * Direct Message Chat Screen
 * Private chat between organizer and participant
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { format, isToday, isYesterday } from 'date-fns';
import { ru } from 'date-fns/locale';

import { Avatar } from '@/components/ui';
import { THEME_COLORS } from '@/constants';
import { selectProfile, useAuthStore } from '@/stores';
import { getProfileById } from '@/services/supabase/profiles.service';
import { supabase } from '@/services/supabase/client';
import type { Profile } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface DirectMessage {
  id: string;
  senderId: string;
  receiverId: string;
  content: string;
  createdAt: Date;
  isRead: boolean;
}

// ============================================================================
// Component
// ============================================================================

export default function DirectMessageScreen() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const currentUser = useAuthStore(selectProfile);

  const [otherUser, setOtherUser] = useState<Profile | null>(null);
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);

  // Fetch user profile and messages
  useEffect(() => {
    async function loadData() {
      if (!userId || !currentUser) return;

      setIsLoading(true);
      try {
        // Fetch other user's profile
        const { profile } = await getProfileById(userId);
        if (profile) {
          setOtherUser(profile);
        }

        // Fetch direct messages
        const { data, error } = await supabase
          .from('direct_messages')
          .select('*')
          .or(
            `and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id})`
          )
          .order('created_at', { ascending: true });

        if (error) {
          // Table might not exist yet - that's OK
          console.log('Direct messages not available yet');
        } else if (data) {
          setMessages(
            data.map((msg) => ({
              id: msg.id,
              senderId: msg.sender_id,
              receiverId: msg.receiver_id,
              content: msg.content,
              createdAt: new Date(msg.created_at),
              isRead: msg.is_read,
            }))
          );
        }
      } catch (error) {
        console.error('Failed to load DM data:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [userId, currentUser]);

  // Subscribe to new messages
  useEffect(() => {
    if (!userId || !currentUser) return;

    const channel = supabase
      .channel(`dm:${[currentUser.id, userId].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'direct_messages',
          filter: `or(and(sender_id.eq.${currentUser.id},receiver_id.eq.${userId}),and(sender_id.eq.${userId},receiver_id.eq.${currentUser.id}))`,
        },
        (payload) => {
          const newMessage: DirectMessage = {
            id: payload.new.id,
            senderId: payload.new.sender_id,
            receiverId: payload.new.receiver_id,
            content: payload.new.content,
            createdAt: new Date(payload.new.created_at),
            isRead: payload.new.is_read,
          };
          setMessages((prev) => [...prev, newMessage]);
          setTimeout(() => {
            flatListRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, currentUser]);

  // Send message
  const handleSend = useCallback(async () => {
    if (!userId || !currentUser || !inputText.trim()) return;

    setIsSending(true);
    try {
      const { error } = await supabase.from('direct_messages').insert({
        sender_id: currentUser.id,
        receiver_id: userId,
        content: inputText.trim(),
      });

      if (error) {
        // If table doesn't exist, show a message
        if (error.message.includes('does not exist')) {
          Alert.alert(
            'Функция в разработке',
            'Личные сообщения скоро будут доступны! Пока вы можете общаться в чате встречи.'
          );
        } else {
          throw error;
        }
      } else {
        setInputText('');
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      Alert.alert('Ошибка', 'Не удалось отправить сообщение');
    } finally {
      setIsSending(false);
    }
  }, [userId, currentUser, inputText]);

  // Render message
  const renderMessage = useCallback(
    ({ item, index }: { item: DirectMessage; index: number }) => {
      const isOwnMessage = item.senderId === currentUser?.id;
      const prevMessage = messages[index - 1];
      const showDate =
        !prevMessage ||
        !isSameDay(item.createdAt, prevMessage.createdAt);

      return (
        <>
          {showDate && (
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>
                {formatMessageDate(item.createdAt)}
              </Text>
            </View>
          )}
          <View
            style={[
              styles.messageContainer,
              isOwnMessage && styles.messageContainerOwn,
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                isOwnMessage && styles.messageBubbleOwn,
              ]}
            >
              <Text
                style={[
                  styles.messageText,
                  isOwnMessage && styles.messageTextOwn,
                ]}
              >
                {item.content}
              </Text>
              <Text
                style={[
                  styles.messageTime,
                  isOwnMessage && styles.messageTimeOwn,
                ]}
              >
                {format(item.createdAt, 'HH:mm')}
              </Text>
            </View>
          </View>
        </>
      );
    },
    [currentUser?.id, messages]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backIcon}>←</Text>
        </Pressable>
        <Pressable
          style={styles.headerProfile}
          onPress={() => router.push(`/profile/${userId}`)}
        >
          <Avatar
            source={otherUser?.avatarUrl ? { uri: otherUser.avatarUrl } : null}
            name={otherUser?.displayName}
            size="md"
          />
          <View style={styles.headerInfo}>
            <Text style={styles.headerName}>{otherUser?.displayName}</Text>
            <Text style={styles.headerStatus}>Личные сообщения</Text>
          </View>
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.messagesContainer}
        keyboardVerticalOffset={0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messagesList}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: false })
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>💬</Text>
              <Text style={styles.emptyText}>
                Начните разговор с {otherUser?.displayName}
              </Text>
            </View>
          }
        />

        {/* Input */}
        <View style={styles.inputContainer}>
          <TextInput
            ref={inputRef}
            style={styles.input}
            placeholder="Сообщение..."
            placeholderTextColor={THEME_COLORS.textMuted}
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[
              styles.sendButton,
              (!inputText.trim() || isSending) && styles.sendButtonDisabled,
            ]}
            onPress={handleSend}
            disabled={!inputText.trim() || isSending}
          >
            <Text style={styles.sendIcon}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

function formatMessageDate(date: Date): string {
  if (isToday(date)) {
    return 'Сегодня';
  }
  if (isYesterday(date)) {
    return 'Вчера';
  }
  return format(date, 'd MMMM', { locale: ru });
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
  },
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 8,
    backgroundColor: THEME_COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: THEME_COLORS.divider,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    color: THEME_COLORS.text,
  },
  headerProfile: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  headerInfo: {
    marginLeft: 12,
  },
  headerName: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  headerStatus: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 16,
    color: THEME_COLORS.textSecondary,
    textAlign: 'center',
  },
  dateHeader: {
    alignItems: 'center',
    marginVertical: 16,
  },
  dateText: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    backgroundColor: THEME_COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  messageContainer: {
    marginBottom: 8,
    maxWidth: '80%',
    alignSelf: 'flex-start',
  },
  messageContainerOwn: {
    alignSelf: 'flex-end',
  },
  messageBubble: {
    backgroundColor: THEME_COLORS.surface,
    borderRadius: 16,
    borderTopLeftRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  messageBubbleOwn: {
    backgroundColor: THEME_COLORS.primary,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 4,
  },
  messageText: {
    fontSize: 15,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageTime: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
    marginTop: 4,
    alignSelf: 'flex-end',
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingBottom: 24,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: THEME_COLORS.background,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    color: THEME_COLORS.text,
    maxHeight: 100,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME_COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: THEME_COLORS.border,
  },
  sendIcon: {
    fontSize: 20,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
