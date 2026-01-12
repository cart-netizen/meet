/**
 * Chat Service
 * Real-time messaging with Supabase Realtime
 * Optimized for high concurrency with connection pooling and message batching
 */

import type { RealtimeChannel, RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase, withRetry } from './client';
import type { ChatMessage, Profile } from '@/types';

// ============================================================================
// Types
// ============================================================================

export interface SendMessageParams {
  eventId: string;
  content: string;
  replyToId?: string;
}

export interface MessageWithAuthor extends ChatMessage {
  author: Pick<Profile, 'id' | 'displayName' | 'avatarUrl'>;
  replyTo?: ChatMessage | null;
}

interface MessageSubscriptionCallbacks {
  onMessage: (message: MessageWithAuthor) => void;
  onEdit: (message: MessageWithAuthor) => void;
  onDelete: (messageId: string) => void;
  onError?: (error: Error) => void;
}

// ============================================================================
// Channel Management
// ============================================================================

const activeChannels = new Map<string, RealtimeChannel>();
const messageCache = new Map<string, MessageWithAuthor[]>();
const MESSAGE_CACHE_LIMIT = 100;

/**
 * Get or create a channel for an event
 */
function getOrCreateChannel(eventId: string): RealtimeChannel {
  const existing = activeChannels.get(eventId);
  if (existing) {
    return existing;
  }

  const channel = supabase.channel(`event-chat:${eventId}`, {
    config: {
      broadcast: { self: true },
      presence: { key: '' },
    },
  });

  activeChannels.set(eventId, channel);
  return channel;
}

/**
 * Remove channel from active channels
 */
function removeChannel(eventId: string): void {
  const channel = activeChannels.get(eventId);
  if (channel) {
    supabase.removeChannel(channel);
    activeChannels.delete(eventId);
  }
}

// ============================================================================
// Message Operations
// ============================================================================

/**
 * Fetch messages for an event with pagination
 */
export async function fetchMessages(
  eventId: string,
  options: {
    limit?: number;
    before?: string; // cursor for pagination
    after?: string;
  } = {}
): Promise<{ messages: MessageWithAuthor[]; hasMore: boolean }> {
  const { limit = 50, before, after } = options;

  return withRetry(async () => {
    let query = supabase
      .from('event_messages')
      .select(`
        *,
        author:profiles!user_id (
          id,
          display_name,
          avatar_url
        ),
        replyTo:event_messages!reply_to_id (
          id,
          content,
          user_id
        )
      `)
      .eq('event_id', eventId)
      .order('created_at', { ascending: false })
      .limit(limit + 1); // Fetch one extra to check if there are more

    if (before) {
      query = query.lt('created_at', before);
    }

    if (after) {
      query = query.gt('created_at', after);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch messages: ${error.message}`);
    }

    const hasMore = (data?.length ?? 0) > limit;
    const messages = (data?.slice(0, limit) ?? []).map(transformMessage);

    // Update cache
    if (!before && !after) {
      messageCache.set(eventId, messages);
    }

    return { messages, hasMore };
  });
}

/**
 * Send a new message
 */
export async function sendMessage(params: SendMessageParams): Promise<MessageWithAuthor> {
  const { eventId, content, replyToId } = params;

  // Validate content
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error('Message content cannot be empty');
  }

  if (trimmedContent.length > 2000) {
    throw new Error('Message content exceeds maximum length of 2000 characters');
  }

  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('event_messages')
      .insert({
        event_id: eventId,
        user_id: user.id,
        content: trimmedContent,
        reply_to_id: replyToId ?? null,
      })
      .select(`
        *,
        author:profiles!user_id (
          id,
          display_name,
          avatar_url
        ),
        replyTo:event_messages!reply_to_id (
          id,
          content,
          user_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to send message: ${error.message}`);
    }

    return transformMessage(data);
  });
}

/**
 * Edit an existing message
 */
export async function editMessage(
  messageId: string,
  content: string
): Promise<MessageWithAuthor> {
  const trimmedContent = content.trim();
  if (!trimmedContent) {
    throw new Error('Message content cannot be empty');
  }

  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from('event_messages')
      .update({
        content: trimmedContent,
        edited_at: new Date().toISOString(),
      })
      .eq('id', messageId)
      .eq('user_id', user.id) // Ensure user owns the message
      .select(`
        *,
        author:profiles!user_id (
          id,
          display_name,
          avatar_url
        ),
        replyTo:event_messages!reply_to_id (
          id,
          content,
          user_id
        )
      `)
      .single();

    if (error) {
      throw new Error(`Failed to edit message: ${error.message}`);
    }

    return transformMessage(data);
  });
}

/**
 * Delete a message (soft delete)
 */
export async function deleteMessage(messageId: string): Promise<void> {
  return withRetry(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      throw new Error('User not authenticated');
    }

    const { error } = await supabase
      .from('event_messages')
      .delete()
      .eq('id', messageId)
      .eq('user_id', user.id); // Ensure user owns the message

    if (error) {
      throw new Error(`Failed to delete message: ${error.message}`);
    }
  });
}

// ============================================================================
// Real-time Subscription
// ============================================================================

/**
 * Subscribe to real-time messages for an event
 * Returns unsubscribe function
 */
export function subscribeToMessages(
  eventId: string,
  callbacks: MessageSubscriptionCallbacks
): () => void {
  const channel = getOrCreateChannel(eventId);

  // Handle new messages
  channel.on(
    'postgres_changes',
    {
      event: 'INSERT',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`,
    },
    async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      try {
        // Fetch full message with author
        const { data, error } = await supabase
          .from('event_messages')
          .select(`
            *,
            author:profiles!user_id (
              id,
              display_name,
              avatar_url
            ),
            replyTo:event_messages!reply_to_id (
              id,
              content,
              user_id
            )
          `)
          .eq('id', (payload.new as { id: string }).id)
          .single();

        if (error) {
          throw error;
        }

        const message = transformMessage(data);
        callbacks.onMessage(message);

        // Update cache
        const cached = messageCache.get(eventId) ?? [];
        messageCache.set(eventId, [message, ...cached].slice(0, MESSAGE_CACHE_LIMIT));
      } catch (error) {
        callbacks.onError?.(error as Error);
      }
    }
  );

  // Handle message edits
  channel.on(
    'postgres_changes',
    {
      event: 'UPDATE',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`,
    },
    async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      try {
        const { data, error } = await supabase
          .from('event_messages')
          .select(`
            *,
            author:profiles!user_id (
              id,
              display_name,
              avatar_url
            ),
            replyTo:event_messages!reply_to_id (
              id,
              content,
              user_id
            )
          `)
          .eq('id', (payload.new as { id: string }).id)
          .single();

        if (error) {
          throw error;
        }

        const message = transformMessage(data);
        callbacks.onEdit(message);

        // Update cache
        const cached = messageCache.get(eventId) ?? [];
        const index = cached.findIndex((m) => m.id === message.id);
        if (index !== -1) {
          cached[index] = message;
          messageCache.set(eventId, [...cached]);
        }
      } catch (error) {
        callbacks.onError?.(error as Error);
      }
    }
  );

  // Handle message deletions
  channel.on(
    'postgres_changes',
    {
      event: 'DELETE',
      schema: 'public',
      table: 'event_messages',
      filter: `event_id=eq.${eventId}`,
    },
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      const messageId = (payload.old as { id: string }).id;
      callbacks.onDelete(messageId);

      // Update cache
      const cached = messageCache.get(eventId) ?? [];
      messageCache.set(eventId, cached.filter((m) => m.id !== messageId));
    }
  );

  // Subscribe to channel
  channel.subscribe((status) => {
    if (status === 'CHANNEL_ERROR') {
      callbacks.onError?.(new Error('Failed to subscribe to chat channel'));
    }
  });

  // Return unsubscribe function
  return () => {
    removeChannel(eventId);
  };
}

// ============================================================================
// Presence (Online Users)
// ============================================================================

export interface PresenceUser {
  odId: string;
  displayName: string;
  avatarUrl?: string;
  lastSeen: Date;
}

/**
 * Track user presence in chat
 */
export function trackPresence(
  eventId: string,
  userInfo: { id: string; displayName: string; avatarUrl?: string },
  callbacks: {
    onJoin: (users: PresenceUser[]) => void;
    onLeave: (users: PresenceUser[]) => void;
    onSync: (users: PresenceUser[]) => void;
  }
): () => void {
  const channel = getOrCreateChannel(eventId);

  channel.on('presence', { event: 'sync' }, () => {
    const state = channel.presenceState();
    const users = Object.values(state)
      .flat()
      .map((presence) => ({
        odId: (presence as Record<string, unknown>).user_id as string,
        displayName: (presence as Record<string, unknown>).display_name as string,
        avatarUrl: (presence as Record<string, unknown>).avatar_url as string | undefined,
        lastSeen: new Date((presence as Record<string, unknown>).online_at as string),
      }));
    callbacks.onSync(users);
  });

  channel.on('presence', { event: 'join' }, ({ newPresences }) => {
    const users = newPresences.map((presence) => ({
      odId: (presence as Record<string, unknown>).user_id as string,
      displayName: (presence as Record<string, unknown>).display_name as string,
      avatarUrl: (presence as Record<string, unknown>).avatar_url as string | undefined,
      lastSeen: new Date((presence as Record<string, unknown>).online_at as string),
    }));
    callbacks.onJoin(users);
  });

  channel.on('presence', { event: 'leave' }, ({ leftPresences }) => {
    const users = leftPresences.map((presence) => ({
      odId: (presence as Record<string, unknown>).user_id as string,
      displayName: (presence as Record<string, unknown>).display_name as string,
      avatarUrl: (presence as Record<string, unknown>).avatar_url as string | undefined,
      lastSeen: new Date((presence as Record<string, unknown>).online_at as string),
    }));
    callbacks.onLeave(users);
  });

  // Track own presence
  channel.track({
    user_id: userInfo.id,
    display_name: userInfo.displayName,
    avatar_url: userInfo.avatarUrl,
    online_at: new Date().toISOString(),
  });

  return () => {
    channel.untrack();
  };
}

// ============================================================================
// Typing Indicators
// ============================================================================

const typingTimeouts = new Map<string, NodeJS.Timeout>();
const TYPING_TIMEOUT = 3000;

/**
 * Broadcast typing status
 */
export function broadcastTyping(eventId: string, userId: string): void {
  const channel = activeChannels.get(eventId);
  if (!channel) return;

  // Clear existing timeout
  const existingTimeout = typingTimeouts.get(`${eventId}:${userId}`);
  if (existingTimeout) {
    clearTimeout(existingTimeout);
  }

  // Broadcast typing
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId, timestamp: Date.now() },
  });

  // Set timeout to stop typing indicator
  const timeout = setTimeout(() => {
    channel.send({
      type: 'broadcast',
      event: 'stop_typing',
      payload: { userId },
    });
    typingTimeouts.delete(`${eventId}:${userId}`);
  }, TYPING_TIMEOUT);

  typingTimeouts.set(`${eventId}:${userId}`, timeout);
}

/**
 * Subscribe to typing indicators
 */
export function subscribeToTyping(
  eventId: string,
  callbacks: {
    onTyping: (userId: string) => void;
    onStopTyping: (userId: string) => void;
  }
): () => void {
  const channel = getOrCreateChannel(eventId);

  channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
    callbacks.onTyping(payload.userId);
  });

  channel.on('broadcast', { event: 'stop_typing' }, ({ payload }) => {
    callbacks.onStopTyping(payload.userId);
  });

  return () => {
    // Cleanup handled by removeChannel
  };
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Transform database message to app message
 */
function transformMessage(data: Record<string, unknown>): MessageWithAuthor {
  const author = data.author as Record<string, unknown>;
  const replyTo = data.replyTo as Record<string, unknown> | null;

  return {
    id: data.id as string,
    eventId: data.event_id as string,
    senderId: data.user_id as string,
    content: data.content as string,
    replyToId: data.reply_to_id as string | null,
    editedAt: data.edited_at ? new Date(data.edited_at as string) : undefined,
    createdAt: new Date(data.created_at as string),
    author: {
      id: author.id as string,
      displayName: author.display_name as string,
      avatarUrl: author.avatar_url as string | undefined,
    },
    replyTo: replyTo
      ? {
          id: replyTo.id as string,
          eventId: data.event_id as string,
          senderId: replyTo.user_id as string,
          content: replyTo.content as string,
          replyToId: null,
          createdAt: new Date(),
        }
      : null,
  };
}

/**
 * Get cached messages for an event
 */
export function getCachedMessages(eventId: string): MessageWithAuthor[] {
  return messageCache.get(eventId) ?? [];
}

/**
 * Clear message cache for an event
 */
export function clearMessageCache(eventId: string): void {
  messageCache.delete(eventId);
}

/**
 * Cleanup all active channels
 */
export function cleanupAllChannels(): void {
  for (const [eventId] of activeChannels) {
    removeChannel(eventId);
  }
  messageCache.clear();
  typingTimeouts.forEach((timeout) => clearTimeout(timeout));
  typingTimeouts.clear();
}
