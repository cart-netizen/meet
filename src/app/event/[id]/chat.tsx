/**
 * Event Chat Screen
 * Real-time messaging for event participants
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
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
import {
  fetchMessages,
  sendMessage,
  subscribeToMessages,
  broadcastTyping,
  subscribeToTyping,
  type MessageWithAuthor,
} from '@/services/supabase/chat.service';
import { getEventById, getEventParticipants } from '@/services/supabase/events.service';
import type { Event } from '@/types';

// ============================================================================
// Component
// ============================================================================

export default function EventChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const profile = useAuthStore(selectProfile);

  const [event, setEvent] = useState<Event | null>(null);
  const [messages, setMessages] = useState<MessageWithAuthor[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const [replyTo, setReplyTo] = useState<MessageWithAuthor | null>(null);
  const [participantsCount, setParticipantsCount] = useState(0);

  const flatListRef = useRef<FlatList>(null);
  const inputRef = useRef<TextInput>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Only organizer can send messages in event chat
  const isOrganizer = event?.organizerId === profile?.id;
  const canSendMessages = isOrganizer;

  // Fetch initial data
  useEffect(() => {
    async function loadData() {
      if (!id) return;

      setIsLoading(true);
      try {
        // Fetch event info and participants
        const [eventData, participantsData, messagesData] = await Promise.all([
          getEventById(id),
          getEventParticipants(id),
          fetchMessages(id),
        ]);

        if (eventData) {
          setEvent(eventData.event);
        }
        if (participantsData.participants) {
          setParticipantsCount(participantsData.participants.length);
        }
        setMessages(messagesData.messages.reverse());
      } catch (error) {
        console.error('Failed to load chat:', error);
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!id) return;

    const unsubscribeMessages = subscribeToMessages(id, {
      onMessage: (message) => {
        setMessages((prev) => {
          // Check if message already exists (from optimistic update)
          if (prev.some(m => m.id === message.id)) {
            return prev;
          }
          return [...prev, message];
        });
        // Scroll to bottom on new message
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
      onEdit: (message) => {
        setMessages((prev) =>
          prev.map((m) => (m.id === message.id ? message : m))
        );
      },
      onDelete: (messageId) => {
        setMessages((prev) => prev.filter((m) => m.id !== messageId));
      },
      onError: (error) => {
        console.error('Chat subscription error:', error);
      },
    });

    const unsubscribeTyping = subscribeToTyping(id, {
      onTyping: (userId) => {
        if (userId !== profile?.id) {
          setTypingUsers((prev) => new Set([...prev, userId]));
        }
      },
      onStopTyping: (userId) => {
        setTypingUsers((prev) => {
          const next = new Set(prev);
          next.delete(userId);
          return next;
        });
      },
    });

    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [id, profile?.id]);

  // Handle typing indicator
  const handleTextChange = useCallback(
    (text: string) => {
      setInputText(text);

      if (id && text.length > 0) {
        // Clear existing timeout
        if (typingTimeoutRef.current) {
          clearTimeout(typingTimeoutRef.current);
        }

        // Broadcast typing
        broadcastTyping(id, profile?.id ?? '');

        // Set timeout to stop typing indicator
        typingTimeoutRef.current = setTimeout(() => {
          typingTimeoutRef.current = null;
        }, 3000);
      }
    },
    [id, profile?.id]
  );

  // Send message
  const handleSend = useCallback(async () => {
    if (!id || !inputText.trim()) return;

    setIsSending(true);
    try {
      const message = await sendMessage({
        eventId: id,
        content: inputText.trim(),
        replyToId: replyTo?.id,
      });
      // Add message immediately (optimistic update)
      setMessages((prev) => {
        // Check if message already exists
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      setInputText('');
      setReplyTo(null);
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setIsSending(false);
    }
  }, [id, inputText, replyTo]);

  // Cancel reply
  const handleCancelReply = useCallback(() => {
    setReplyTo(null);
  }, []);

  // Reply to message
  const handleReply = useCallback((message: MessageWithAuthor) => {
    setReplyTo(message);
    inputRef.current?.focus();
  }, []);

  // Render message item
  const renderMessage = useCallback(
    ({ item, index }: { item: MessageWithAuthor; index: number }) => {
      const isOwnMessage = item.senderId === profile?.id;
      const prevMessage = messages[index - 1];
      const showDate =
        !prevMessage ||
        !isSameDay(new Date(item.createdAt), new Date(prevMessage.createdAt));
      const showAuthor =
        !isOwnMessage &&
        (!prevMessage || prevMessage.senderId !== item.senderId);

      return (
        <>
          {showDate && (
            <View style={styles.dateHeader}>
              <Text style={styles.dateText}>
                {formatMessageDate(item.createdAt)}
              </Text>
            </View>
          )}
          <Pressable
            style={[
              styles.messageContainer,
              isOwnMessage && styles.messageContainerOwn,
            ]}
            onLongPress={() => handleReply(item)}
          >
            {showAuthor && !isOwnMessage && (
              <View style={styles.messageAuthor}>
                <Avatar
                  source={
                    item.author.avatarUrl
                      ? { uri: item.author.avatarUrl }
                      : null
                  }
                  name={item.author.displayName}
                  size="sm"
                />
                <Text style={styles.messageAuthorName}>
                  {item.author.displayName}
                </Text>
              </View>
            )}

            <View
              style={[
                styles.messageBubble,
                isOwnMessage && styles.messageBubbleOwn,
              ]}
            >
              {item.replyTo && (
                <View style={styles.replyPreview}>
                  <Text style={styles.replyPreviewText} numberOfLines={1}>
                    {item.replyTo.content}
                  </Text>
                </View>
              )}
              <Text
                style={[
                  styles.messageText,
                  isOwnMessage && styles.messageTextOwn,
                ]}
              >
                {item.content}
              </Text>
              <View style={styles.messageFooter}>
                <Text
                  style={[
                    styles.messageTime,
                    isOwnMessage && styles.messageTimeOwn,
                  ]}
                >
                  {format(item.createdAt, 'HH:mm')}
                </Text>
                {item.editedAt && (
                  <Text
                    style={[
                      styles.messageEdited,
                      isOwnMessage && styles.messageTimeOwn,
                    ]}
                  >
                    изменено
                  </Text>
                )}
              </View>
            </View>
          </Pressable>
        </>
      );
    },
    [profile?.id, messages, handleReply]
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loading}>
          <Text style={styles.loadingText}>Загрузка чата...</Text>
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
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event?.title ?? 'Чат'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {participantsCount} участников
          </Text>
        </View>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.push(`/event/${id}`)}
        >
          <Text style={styles.headerIcon}>ℹ️</Text>
        </Pressable>
      </View>

      {/* Messages */}
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.messagesContainer}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
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
                Начните обсуждение встречи!
              </Text>
            </View>
          }
        />

        {/* Typing Indicator */}
        {typingUsers.size > 0 && (
          <View style={styles.typingIndicator}>
            <View style={styles.typingDots}>
              <View style={[styles.typingDot, styles.typingDot1]} />
              <View style={[styles.typingDot, styles.typingDot2]} />
              <View style={[styles.typingDot, styles.typingDot3]} />
            </View>
            <Text style={styles.typingText}>
              {typingUsers.size === 1 ? 'печатает...' : 'печатают...'}
            </Text>
          </View>
        )}

        {/* Reply Preview */}
        {replyTo && (
          <View style={styles.replyBar}>
            <View style={styles.replyContent}>
              <Text style={styles.replyLabel}>
                Ответ для {replyTo.author.displayName}
              </Text>
              <Text style={styles.replyText} numberOfLines={1}>
                {replyTo.content}
              </Text>
            </View>
            <Pressable style={styles.replyCancelButton} onPress={handleCancelReply}>
              <Text style={styles.replyCancelIcon}>✕</Text>
            </Pressable>
          </View>
        )}

        {/* Input - Only organizer can send */}
        {canSendMessages ? (
          <View style={styles.inputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.input}
              placeholder="Сообщение..."
              placeholderTextColor={THEME_COLORS.textMuted}
              value={inputText}
              onChangeText={handleTextChange}
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
        ) : (
          <View style={styles.readOnlyContainer}>
            <Text style={styles.readOnlyIcon}>🔒</Text>
            <Text style={styles.readOnlyText}>
              Только организатор может писать в этот чат
            </Text>
          </View>
        )}
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
  headerContent: {
    flex: 1,
    marginHorizontal: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: THEME_COLORS.text,
  },
  headerSubtitle: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  headerButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerIcon: {
    fontSize: 20,
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
  messageAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
    gap: 6,
  },
  messageAuthorName: {
    fontSize: 13,
    fontWeight: '500',
    color: THEME_COLORS.textSecondary,
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
  replyPreview: {
    borderLeftWidth: 2,
    borderLeftColor: THEME_COLORS.textMuted,
    paddingLeft: 8,
    marginBottom: 6,
  },
  replyPreviewText: {
    fontSize: 13,
    color: THEME_COLORS.textSecondary,
    fontStyle: 'italic',
  },
  messageText: {
    fontSize: 15,
    color: THEME_COLORS.text,
    lineHeight: 20,
  },
  messageTextOwn: {
    color: '#FFFFFF',
  },
  messageFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 6,
  },
  messageTime: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
  },
  messageTimeOwn: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  messageEdited: {
    fontSize: 11,
    color: THEME_COLORS.textMuted,
    fontStyle: 'italic',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  typingDots: {
    flexDirection: 'row',
    gap: 4,
  },
  typingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: THEME_COLORS.textMuted,
  },
  typingDot1: {
    opacity: 0.4,
  },
  typingDot2: {
    opacity: 0.6,
  },
  typingDot3: {
    opacity: 0.8,
  },
  typingText: {
    fontSize: 13,
    color: THEME_COLORS.textMuted,
    fontStyle: 'italic',
  },
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
  },
  replyContent: {
    flex: 1,
    borderLeftWidth: 2,
    borderLeftColor: THEME_COLORS.primary,
    paddingLeft: 10,
  },
  replyLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: THEME_COLORS.primary,
  },
  replyText: {
    fontSize: 14,
    color: THEME_COLORS.textSecondary,
    marginTop: 2,
  },
  replyCancelButton: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replyCancelIcon: {
    fontSize: 16,
    color: THEME_COLORS.textMuted,
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
  readOnlyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    paddingBottom: 32,
    backgroundColor: THEME_COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: THEME_COLORS.divider,
    gap: 8,
  },
  readOnlyIcon: {
    fontSize: 16,
  },
  readOnlyText: {
    fontSize: 14,
    color: THEME_COLORS.textMuted,
  },
});
