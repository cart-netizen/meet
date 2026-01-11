/**
 * Push Notifications Service - Web Version
 * Stub implementation for web platform (expo-notifications not supported)
 */

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

// ============================================================================
// Token Management (Not supported on web)
// ============================================================================

/**
 * Register for push notifications - not supported on web
 */
export async function registerForPushNotifications(): Promise<string | null> {
  console.warn('Push notifications not available on web');
  return null;
}

/**
 * Remove push token - no-op on web
 */
export async function removePushToken(): Promise<void> {
  // No-op on web
}

/**
 * Get current push token - not available on web
 */
export function getPushToken(): string | null {
  return null;
}

// ============================================================================
// Local Notifications (Not supported on web)
// ============================================================================

/**
 * Schedule a local notification - not supported on web
 */
export async function scheduleLocalNotification(
  _payload: PushNotificationPayload,
  _trigger?: unknown
): Promise<string> {
  console.warn('Local notifications not available on web');
  return '';
}

/**
 * Schedule event reminder notification - not supported on web
 */
export async function scheduleEventReminder(
  _eventId: string,
  _eventTitle: string,
  _startsAt: Date,
  _minutesBefore?: number
): Promise<string | null> {
  console.warn('Event reminders not available on web');
  return null;
}

/**
 * Cancel scheduled notification - no-op on web
 */
export async function cancelScheduledNotification(_notificationId: string): Promise<void> {
  // No-op on web
}

/**
 * Cancel all scheduled notifications for an event - no-op on web
 */
export async function cancelEventNotifications(_eventId: string): Promise<void> {
  // No-op on web
}

/**
 * Get all scheduled notifications - returns empty array on web
 */
export async function getScheduledNotifications(): Promise<unknown[]> {
  return [];
}

// ============================================================================
// Notification Listeners (Not supported on web)
// ============================================================================

/**
 * Add listener for received notifications - returns cleanup function
 */
export function addNotificationListener(_listener: unknown): () => void {
  return () => {};
}

/**
 * Add listener for notification responses - returns cleanup function
 */
export function addResponseListener(_listener: unknown): () => void {
  return () => {};
}

/**
 * Initialize notification listeners - returns cleanup function
 */
export function initializeNotificationListeners(): () => void {
  return () => {};
}

// ============================================================================
// Badge Management (Not supported on web)
// ============================================================================

/**
 * Set app badge count - no-op on web
 */
export async function setBadgeCount(_count: number): Promise<void> {
  // No-op on web
}

/**
 * Get current badge count - returns 0 on web
 */
export async function getBadgeCount(): Promise<number> {
  return 0;
}

/**
 * Clear badge - no-op on web
 */
export async function clearBadge(): Promise<void> {
  // No-op on web
}

// ============================================================================
// Notification Preferences
// ============================================================================

const DEFAULT_PREFERENCES: NotificationPreferences = {
  eventReminders: false,
  chatMessages: false,
  newParticipants: false,
  eventUpdates: false,
  promotions: false,
};

/**
 * Get notification preferences - returns defaults on web
 */
export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  return DEFAULT_PREFERENCES;
}

/**
 * Update notification preferences - no-op on web
 */
export async function updateNotificationPreferences(
  _preferences: Partial<NotificationPreferences>
): Promise<void> {
  console.warn('Notification preferences not available on web');
}

// ============================================================================
// Helpers
// ============================================================================

/**
 * Check if notifications are enabled - returns false on web
 */
export async function areNotificationsEnabled(): Promise<boolean> {
  return false;
}

/**
 * Open device notification settings - no-op on web
 */
export async function openNotificationSettings(): Promise<void> {
  console.warn('Notification settings not available on web');
}

/**
 * Dismiss all notifications - no-op on web
 */
export async function dismissAllNotifications(): Promise<void> {
  // No-op on web
}

/**
 * Dismiss a specific notification - no-op on web
 */
export async function dismissNotification(_notificationId: string): Promise<void> {
  // No-op on web
}
