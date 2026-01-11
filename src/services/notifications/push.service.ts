/**
 * Push Notifications Service
 * Handles push notification registration, permissions, and local notifications
 * Uses expo-notifications for cross-platform support
 *
 * Note: expo-notifications has limited support in Expo Go SDK 53+.
 * This service provides graceful degradation when running in Expo Go.
 * We use conditional require() to avoid loading the module in Expo Go.
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/services/supabase/client';

// ============================================================================
// Expo Go Detection
// ============================================================================

/**
 * Check if app is running in Expo Go
 * expo-notifications has limited support in Expo Go SDK 53+
 */
const isExpoGo = Constants.appOwnership === 'expo';

// ============================================================================
// Conditional Imports
// ============================================================================

// Only import expo-notifications when NOT in Expo Go to avoid warnings
// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const Notifications: typeof import('expo-notifications') | null = isExpoGo
  ? null
  : require('expo-notifications');

// eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
const Device: typeof import('expo-device') | null = isExpoGo
  ? null
  : require('expo-device');

// ============================================================================
// Configuration
// ============================================================================

// Configure how notifications are handled when app is in foreground
// Only configure on native platforms (not web) and not in Expo Go
if (Platform.OS !== 'web' && !isExpoGo && Notifications) {
  try {
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
  } catch (error) {
    console.warn('Failed to configure notification handler:', error);
  }
}

// ============================================================================
// Types
// ============================================================================

export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface NotificationPreferences {
  eventReminders: boolean;
  chatMessages: boolean;
  newParticipants: boolean;
  eventUpdates: boolean;
  promotions: boolean;
}

// Use generic types to avoid dependency on expo-notifications types in Expo Go
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotificationListener = (notification: any) => void;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResponseListener = (response: any) => void;

// Type for notification trigger input
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotificationTriggerInput = any;

// Type for notification requests
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type NotificationRequest = any;

// ============================================================================
// State
// ============================================================================

let expoPushToken: string | null = null;
const notificationListeners = new Set<NotificationListener>();
const responseListeners = new Set<ResponseListener>();

// ============================================================================
// Token Management
// ============================================================================

/**
 * Register for push notifications and get token
 */
export async function registerForPushNotifications(): Promise<string | null> {
  // Skip in Expo Go - notifications have limited support in SDK 53+
  if (isExpoGo || !Notifications || !Device) {
    console.info('Push notifications are not fully supported in Expo Go');
    return null;
  }

  // Check if physical device (push notifications don't work on simulators)
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request permission if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.warn('Push notification permission not granted');
    return null;
  }

  // Configure Android notification channel
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF6B35',
    });

    // Create channels for different notification types
    await Promise.all([
      Notifications.setNotificationChannelAsync('event_reminders', {
        name: 'Напоминания о встречах',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF6B35',
      }),
      Notifications.setNotificationChannelAsync('chat_messages', {
        name: 'Сообщения в чатах',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 100],
      }),
      Notifications.setNotificationChannelAsync('updates', {
        name: 'Обновления',
        importance: Notifications.AndroidImportance.LOW,
      }),
    ]);
  }

  try {
    // Get Expo push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: process.env.EXPO_PROJECT_ID,
    });
    expoPushToken = tokenData.data;

    // Save token to database
    await savePushToken(expoPushToken);

    return expoPushToken;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

/**
 * Save push token to database
 */
async function savePushToken(token: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('push_tokens')
      .upsert(
        {
          user_id: user.id,
          token,
          platform: Platform.OS,
          device_name: Device?.deviceName ?? 'Unknown',
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'user_id,token',
        }
      );
  } catch (error) {
    console.error('Failed to save push token:', error);
  }
}

/**
 * Remove push token from database
 */
export async function removePushToken(): Promise<void> {
  if (!expoPushToken) return;

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('push_tokens')
      .delete()
      .eq('user_id', user.id)
      .eq('token', expoPushToken);

    expoPushToken = null;
  } catch (error) {
    console.error('Failed to remove push token:', error);
  }
}

/**
 * Get current push token
 */
export function getPushToken(): string | null {
  return expoPushToken;
}

// ============================================================================
// Local Notifications
// ============================================================================

/**
 * Schedule a local notification
 */
export async function scheduleLocalNotification(
  payload: PushNotificationPayload,
  trigger: NotificationTriggerInput = null
): Promise<string> {
  // Skip in Expo Go
  if (isExpoGo || !Notifications) {
    console.info('Local notifications are not supported in Expo Go');
    return '';
  }

  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: payload.title,
        body: payload.body,
        data: payload.data ?? {},
        sound: true,
      },
      trigger,
    });

    return notificationId;
  } catch (error) {
    console.warn('Failed to schedule notification:', error);
    return '';
  }
}

/**
 * Schedule event reminder notification
 */
export async function scheduleEventReminder(
  eventId: string,
  eventTitle: string,
  startsAt: Date,
  minutesBefore: number = 60
): Promise<string | null> {
  // Skip in Expo Go
  if (isExpoGo || !Notifications) {
    console.info('Event reminders are not supported in Expo Go');
    return null;
  }

  const triggerDate = new Date(startsAt.getTime() - minutesBefore * 60 * 1000);

  // Don't schedule if trigger time is in the past
  if (triggerDate <= new Date()) {
    return null;
  }

  let notificationId: string;
  try {
    notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Напоминание о встрече',
        body: `${eventTitle} начнётся через ${minutesBefore} минут`,
        data: {
          type: 'event_reminder',
          eventId,
        },
        sound: true,
        categoryIdentifier: 'event_reminder',
      },
      trigger: {
        date: triggerDate,
        channelId: 'event_reminders',
      },
    });
  } catch (error) {
    console.warn('Failed to schedule event reminder:', error);
    return null;
  }

  // Save reminder to database for tracking
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('scheduled_notifications').upsert({
        user_id: user.id,
        event_id: eventId,
        notification_id: notificationId,
        scheduled_for: triggerDate.toISOString(),
        type: 'event_reminder',
      });
    }
  } catch (error) {
    console.error('Failed to save scheduled notification:', error);
  }

  return notificationId;
}

/**
 * Cancel scheduled notification
 */
export async function cancelScheduledNotification(notificationId: string): Promise<void> {
  if (!isExpoGo && Notifications) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
    } catch (error) {
      console.warn('Failed to cancel scheduled notification:', error);
    }
  }

  // Remove from database
  try {
    await supabase
      .from('scheduled_notifications')
      .delete()
      .eq('notification_id', notificationId);
  } catch (error) {
    console.error('Failed to remove scheduled notification from database:', error);
  }
}

/**
 * Cancel all scheduled notifications for an event
 */
export async function cancelEventNotifications(eventId: string): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Get notification IDs from database
    const { data: notifications } = await supabase
      .from('scheduled_notifications')
      .select('notification_id')
      .eq('user_id', user.id)
      .eq('event_id', eventId);

    if (notifications) {
      // Only cancel from system if not in Expo Go
      if (!isExpoGo && Notifications) {
        await Promise.all(
          notifications.map((n) =>
            Notifications.cancelScheduledNotificationAsync(n.notification_id).catch((err) =>
              console.warn('Failed to cancel notification:', err)
            )
          )
        );
      }

      await supabase
        .from('scheduled_notifications')
        .delete()
        .eq('user_id', user.id)
        .eq('event_id', eventId);
    }
  } catch (error) {
    console.error('Failed to cancel event notifications:', error);
  }
}

/**
 * Get all scheduled notifications
 */
export async function getScheduledNotifications(): Promise<NotificationRequest[]> {
  if (isExpoGo || !Notifications) return [];
  try {
    return await Notifications.getAllScheduledNotificationsAsync();
  } catch (error) {
    console.warn('Failed to get scheduled notifications:', error);
    return [];
  }
}

// ============================================================================
// Notification Listeners
// ============================================================================

/**
 * Add listener for received notifications (foreground)
 */
export function addNotificationListener(listener: NotificationListener): () => void {
  notificationListeners.add(listener);
  return () => {
    notificationListeners.delete(listener);
  };
}

/**
 * Add listener for notification responses (taps)
 */
export function addResponseListener(listener: ResponseListener): () => void {
  responseListeners.add(listener);
  return () => {
    responseListeners.delete(listener);
  };
}

/**
 * Initialize notification listeners
 * Call this once when app starts
 */
export function initializeNotificationListeners(): () => void {
  // Skip in Expo Go - notifications have limited support in SDK 53+
  if (isExpoGo || !Notifications) {
    return () => {}; // Return no-op cleanup function
  }

  try {
    // Listen for notifications received while app is in foreground
    const notificationSubscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        notificationListeners.forEach((listener) => listener(notification));
      }
    );

    // Listen for notification responses (user taps on notification)
    const responseSubscription = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        responseListeners.forEach((listener) => listener(response));
      }
    );

    // Return cleanup function
    return () => {
      notificationSubscription.remove();
      responseSubscription.remove();
    };
  } catch (error) {
    console.warn('Failed to initialize notification listeners:', error);
    return () => {}; // Return no-op cleanup function
  }
}

// ============================================================================
// Badge Management
// ============================================================================

/**
 * Set app badge count
 */
export async function setBadgeCount(count: number): Promise<void> {
  if (isExpoGo || !Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(count);
  } catch (error) {
    console.warn('Failed to set badge count:', error);
  }
}

/**
 * Get current badge count
 */
export async function getBadgeCount(): Promise<number> {
  if (isExpoGo || !Notifications) return 0;
  try {
    return await Notifications.getBadgeCountAsync();
  } catch (error) {
    console.warn('Failed to get badge count:', error);
    return 0;
  }
}

/**
 * Clear badge
 */
export async function clearBadge(): Promise<void> {
  if (isExpoGo || !Notifications) return;
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch (error) {
    console.warn('Failed to clear badge:', error);
  }
}

// ============================================================================
// Notification Preferences
// ============================================================================

const DEFAULT_PREFERENCES: NotificationPreferences = {
  eventReminders: true,
  chatMessages: true,
  newParticipants: true,
  eventUpdates: true,
  promotions: false,
};

/**
 * Get notification preferences
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return DEFAULT_PREFERENCES;

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (!data) return DEFAULT_PREFERENCES;

    return {
      eventReminders: data.event_reminders ?? true,
      chatMessages: data.chat_messages ?? true,
      newParticipants: data.new_participants ?? true,
      eventUpdates: data.event_updates ?? true,
      promotions: data.promotions ?? false,
    };
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Update notification preferences
 */
export async function updateNotificationPreferences(
  preferences: Partial<NotificationPreferences>
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      event_reminders: preferences.eventReminders,
      chat_messages: preferences.chatMessages,
      new_participants: preferences.newParticipants,
      event_updates: preferences.eventUpdates,
      promotions: preferences.promotions,
      updated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
  }
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if notifications are enabled
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  if (isExpoGo || !Notifications) return false;
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return status === 'granted';
  } catch (error) {
    console.warn('Failed to check notification permissions:', error);
    return false;
  }
}

/**
 * Open device notification settings
 */
export async function openNotificationSettings(): Promise<void> {
  if (!Notifications) return;
  // This will open the app's notification settings on the device
  if (Platform.OS === 'ios') {
    // On iOS, we can't directly open settings, but we can prompt
    await Notifications.requestPermissionsAsync();
  }
  // On Android, users need to go to Settings manually
}

/**
 * Dismiss all notifications
 */
export async function dismissAllNotifications(): Promise<void> {
  if (isExpoGo || !Notifications) return;
  try {
    await Notifications.dismissAllNotificationsAsync();
  } catch (error) {
    console.warn('Failed to dismiss notifications:', error);
  }
}

/**
 * Dismiss a specific notification
 */
export async function dismissNotification(notificationId: string): Promise<void> {
  if (isExpoGo || !Notifications) return;
  try {
    await Notifications.dismissNotificationAsync(notificationId);
  } catch (error) {
    console.warn('Failed to dismiss notification:', error);
  }
}
