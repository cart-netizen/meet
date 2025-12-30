/**
 * Chat Store
 * Manages event chat messages with real-time updates
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

import { CHAT_CONFIG } from '@/constants';
import { supabase } from '@/services/supabase/client';
import type { EventMessage, Profile } from '@/types';

// ============================================================================
// Types
// ============================================================================

interface ChatState {
  // State
  messages: Map<string, EventMessage[]>; // eventId -> messages
  isLoading: Map<string, boolean>;
  isSending: boolean;
  subscriptions: Map<string, () => void>; // eventId -> unsubscribe
  error: string | null;

  // Rate limiting
  messageCount: number;
  lastMessageTime: number;

  // Actions
  fetchMessages: (eventId: string) => Promise<void>;
  sendMessage: (eventId: string, content: string) => Promise<{ error?: string }>;
  subscribeToMessages: (eventId: string) => void;
  unsubscribeFromMessages: (eventId: string) => void;
  clearChat: (eventId: string) => void;
  clearError: () => void;
}

// ============================================================================
// Store
// ============================================================================

export const useChatStore = create<ChatState>()(
  immer((set, get) => ({
    // Initial state
    messages: new Map(),
    isLoading: new Map(),
    isSending: false,
    subscriptions: new Map(),
    error: null,
    messageCount: 0,
    lastMessageTime: 0,

    // Fetch messages for an event
    fetchMessages: async (eventId) => {
      set((state) => {
        state.isLoading.set(eventId, true);
        state.error = null;
      });

      try {
        const { data, error } = await supabase
          .from('event_messages')
          .select(
            `
            *,
            user:profiles!user_id(id, display_name, avatar_url)
          `
          )
          .eq('event_id', eventId)
          .order('created_at', { ascending: true })
          .limit(CHAT_CONFIG.messagesPerPage);

        if (error) {
          throw new Error(error.message);
        }

        const messages: EventMessage[] = (data ?? []).map(transformMessage);

        set((state) => {
          state.messages.set(eventId, messages);
          state.isLoading.set(eventId, false);
        });
      } catch (error) {
        set((state) => {
          state.error = error instanceof Error ? error.message : 'Failed to fetch messages';
          state.isLoading.set(eventId, false);
        });
      }
    },

    // Send a message
    sendMessage: async (eventId, content) => {
      const { messageCount, lastMessageTime } = get();
      const now = Date.now();

      // Rate limiting
      if (now - lastMessageTime < 60000) {
        if (messageCount >= CHAT_CONFIG.maxMessagesPerMinute) {
          return { error: 'Too many messages. Please wait a moment.' };
        }
      }

      // Validate content
      const trimmedContent = content.trim();
      if (!trimmedContent) {
        return { error: 'Message cannot be empty' };
      }
      if (trimmedContent.length > CHAT_CONFIG.maxMessageLength) {
        return { error: `Message too long (max ${CHAT_CONFIG.maxMessageLength} characters)` };
      }

      set((state) => {
        state.isSending = true;
      });

      try {
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
          throw new Error('Not authenticated');
        }

        const { error } = await supabase.from('event_messages').insert({
          event_id: eventId,
          user_id: user.id,
          content: trimmedContent,
        });

        if (error) {
          throw new Error(error.message);
        }

        // Update rate limiting
        set((state) => {
          state.isSending = false;
          if (now - state.lastMessageTime >= 60000) {
            state.messageCount = 1;
          } else {
            state.messageCount += 1;
          }
          state.lastMessageTime = now;
        });

        return {};
      } catch (error) {
        set((state) => {
          state.isSending = false;
          state.error = error instanceof Error ? error.message : 'Failed to send message';
        });
        return {
          error: error instanceof Error ? error.message : 'Failed to send message',
        };
      }
    },

    // Subscribe to real-time messages
    subscribeToMessages: (eventId) => {
      const { subscriptions } = get();

      // Already subscribed
      if (subscriptions.has(eventId)) {
        return;
      }

      const channel = supabase
        .channel(`event-chat-${eventId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'event_messages',
            filter: `event_id=eq.${eventId}`,
          },
          async (payload) => {
            // Fetch full message with user profile
            const { data } = await supabase
              .from('event_messages')
              .select(
                `
                *,
                user:profiles!user_id(id, display_name, avatar_url)
              `
              )
              .eq('id', payload.new.id)
              .single();

            if (data) {
              const message = transformMessage(data);

              set((state) => {
                const currentMessages = state.messages.get(eventId) ?? [];
                // Avoid duplicates
                if (!currentMessages.some((m) => m.id === message.id)) {
                  state.messages.set(eventId, [...currentMessages, message]);
                }
              });
            }
          }
        )
        .subscribe();

      // Store unsubscribe function
      const unsubscribe = () => {
        supabase.removeChannel(channel);
      };

      set((state) => {
        state.subscriptions.set(eventId, unsubscribe);
      });
    },

    // Unsubscribe from real-time messages
    unsubscribeFromMessages: (eventId) => {
      const { subscriptions } = get();
      const unsubscribe = subscriptions.get(eventId);

      if (unsubscribe) {
        unsubscribe();
        set((state) => {
          state.subscriptions.delete(eventId);
        });
      }
    },

    // Clear chat messages for an event
    clearChat: (eventId) => {
      const { subscriptions } = get();
      const unsubscribe = subscriptions.get(eventId);

      if (unsubscribe) {
        unsubscribe();
      }

      set((state) => {
        state.messages.delete(eventId);
        state.subscriptions.delete(eventId);
        state.isLoading.delete(eventId);
      });
    },

    // Clear error
    clearError: () => {
      set((state) => {
        state.error = null;
      });
    },
  }))
);

// ============================================================================
// Transform Functions
// ============================================================================

function transformMessage(data: Record<string, unknown>): EventMessage {
  const user = data.user as Record<string, unknown> | null;

  return {
    id: data.id as string,
    eventId: data.event_id as string,
    userId: data.user_id as string,
    content: data.content as string,
    isSystem: Boolean(data.is_system),
    createdAt: new Date(data.created_at as string),
    user: user
      ? {
          id: user.id as string,
          displayName: user.display_name as string,
          avatarUrl: user.avatar_url as string | null,
        }
      : undefined,
  };
}

// ============================================================================
// Selectors
// ============================================================================

export const selectMessages = (eventId: string) => (state: ChatState) =>
  state.messages.get(eventId) ?? [];

export const selectIsLoadingMessages = (eventId: string) => (state: ChatState) =>
  state.isLoading.get(eventId) ?? false;

export const selectIsSendingMessage = (state: ChatState) => state.isSending;
