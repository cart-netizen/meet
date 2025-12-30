/**
 * Application constants
 * Centralized configuration for the MeetUp.local platform
 */

// ============================================================================
// Application Config
// ============================================================================

export const APP_CONFIG = {
  name: 'MeetUp.local',
  displayName: 'СвоиЛюди',
  version: '1.0.0',
  scheme: 'meetuplocal',
  bundleId: {
    ios: 'com.meetuplocal.app',
    android: 'com.meetuplocal.app',
  },
} as const;

// ============================================================================
// API & Backend Config
// ============================================================================

export const API_CONFIG = {
  supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
  yandexMapsApiKey: process.env.EXPO_PUBLIC_YANDEX_MAPS_API_KEY ?? '',
  yookassaShopId: process.env.EXPO_PUBLIC_YOOKASSA_SHOP_ID ?? '',
} as const;

// ============================================================================
// Subscription & Pricing Config
// ============================================================================

export const SUBSCRIPTION_CONFIG = {
  prices: {
    participant: 199, // RUB per month
    organizer: 499, // RUB per month
    singleEvent: 99, // RUB per event
  },
  trialDays: 0, // No trial for MVP
  features: {
    free: [
      'Просмотр встреч',
      'Просмотр профилей',
      'Базовый профиль',
    ],
    participant: [
      'Все из Free',
      'Запись на встречи',
      'Чат с участниками',
      'Оставлять отзывы',
      'Верифицированный профиль',
    ],
    organizer: [
      'Все из Участник',
      'Создание неограниченных встреч',
      'Модерация участников',
      'Аналитика встреч',
      'Приоритет в поиске',
    ],
  },
} as const;

// ============================================================================
// Event Config
// ============================================================================

export const EVENT_CONFIG = {
  minParticipants: 2,
  maxParticipants: 100,
  minDurationMinutes: 30,
  maxDurationMinutes: 480, // 8 hours
  maxTags: 5,
  titleMinLength: 5,
  titleMaxLength: 100,
  descriptionMaxLength: 2000,
  maxEventsPerDay: 10, // Per organizer
  defaultDurationMinutes: 120,
  // Time before event when joining is closed (minutes)
  joiningClosedBeforeMinutes: 30,
  // Time after event start to mark attendance (minutes)
  attendanceMarkingWindowMinutes: 120,
} as const;

// ============================================================================
// Search & Discovery Config
// ============================================================================

export const SEARCH_CONFIG = {
  defaultRadius: 10, // km
  maxRadius: 100, // km
  radiusOptions: [1, 3, 5, 10, 25, 50, 100], // km
  defaultDateRange: 30, // days
  maxDateRange: 90, // days
  eventsPerPage: 20,
  maxSearchResults: 100,
} as const;

// ============================================================================
// No-Show Policy Config
// ============================================================================

export const NO_SHOW_CONFIG = {
  warningThreshold: 1, // First no-show: warning
  firstBanThreshold: 2, // Second no-show: 7-day ban
  secondBanThreshold: 3, // Third no-show: 30-day ban
  firstBanDays: 7,
  secondBanDays: 30,
  // Hours after event start when no-shows are processed
  processingDelayHours: 2,
} as const;

// ============================================================================
// Rating Config
// ============================================================================

export const RATING_CONFIG = {
  minRating: 1,
  maxRating: 5,
  defaultRating: 5.0,
  // Rating thresholds for search ranking
  lowRatingThreshold: 3.0, // Demoted in search
  criticalRatingThreshold: 2.0, // Requires manual moderation
} as const;

// ============================================================================
// Profile Config
// ============================================================================

export const PROFILE_CONFIG = {
  minDisplayNameLength: 2,
  maxDisplayNameLength: 50,
  maxBioLength: 500,
  minInterests: 3,
  maxInterests: 15,
  minAge: 18,
  maxAge: 100,
  // Avatar
  avatarMaxSizeBytes: 5 * 1024 * 1024, // 5MB
  avatarAllowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
} as const;

// ============================================================================
// Chat Config
// ============================================================================

export const CHAT_CONFIG = {
  maxMessageLength: 500,
  messagesPerPage: 50,
  // Rate limiting
  maxMessagesPerMinute: 20,
  // Cooldown after reaching rate limit (seconds)
  rateLimitCooldownSeconds: 60,
} as const;

// ============================================================================
// Notification Config
// ============================================================================

export const NOTIFICATION_CONFIG = {
  // Reminder times before event (hours)
  reminderTimes: [24, 2], // 24 hours and 2 hours before
  // Types that trigger push notifications
  pushEnabledTypes: [
    'event_reminder',
    'participant_approved',
    'participant_declined',
    'event_cancelled',
    'new_message',
  ],
} as const;

// ============================================================================
// Cache Config (for high-load optimization)
// ============================================================================

export const CACHE_CONFIG = {
  // Local cache TTL (milliseconds)
  eventListTTL: 60 * 1000, // 1 minute
  profileTTL: 5 * 60 * 1000, // 5 minutes
  categoriesTTL: 24 * 60 * 60 * 1000, // 24 hours
  // Stale-while-revalidate window (milliseconds)
  staleWindow: 30 * 1000, // 30 seconds
} as const;

// ============================================================================
// Validation Patterns
// ============================================================================

export const VALIDATION_PATTERNS = {
  email: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
  phone: /^(\+7|8)?[\s-]?\(?\d{3}\)?[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/,
  displayName: /^[\p{L}\p{N}\s\-_.]+$/u,
} as const;

// ============================================================================
// Error Messages (Russian)
// ============================================================================

export const ERROR_MESSAGES = {
  // Auth
  invalidEmail: 'Некорректный email адрес',
  passwordTooShort: 'Пароль должен содержать минимум 8 символов',
  passwordMismatch: 'Пароли не совпадают',
  invalidCredentials: 'Неверный email или пароль',
  emailAlreadyExists: 'Пользователь с таким email уже существует',

  // Profile
  displayNameTooShort: 'Имя должно содержать минимум 2 символа',
  displayNameInvalid: 'Имя содержит недопустимые символы',
  bioTooLong: 'Описание слишком длинное',
  notEnoughInterests: 'Выберите минимум 3 интереса',

  // Event
  titleTooShort: 'Название должно содержать минимум 5 символов',
  titleTooLong: 'Название слишком длинное',
  descriptionTooLong: 'Описание слишком длинное',
  invalidDate: 'Выберите дату в будущем',
  invalidParticipants: 'Некорректное количество участников',
  eventFull: 'Все места заняты',
  eventCancelled: 'Мероприятие отменено',
  alreadyJoined: 'Вы уже записаны на это мероприятие',

  // Subscription
  subscriptionRequired: 'Требуется подписка',
  organizerRequired: 'Требуется подписка организатора',
  paymentFailed: 'Ошибка оплаты',

  // General
  networkError: 'Ошибка сети. Проверьте подключение к интернету',
  serverError: 'Ошибка сервера. Попробуйте позже',
  unknownError: 'Произошла неизвестная ошибка',
  notFound: 'Не найдено',
  forbidden: 'Доступ запрещён',
  banned: 'Ваш аккаунт заблокирован',
  rateLimited: 'Слишком много запросов. Подождите немного',
} as const;

// ============================================================================
// Success Messages (Russian)
// ============================================================================

export const SUCCESS_MESSAGES = {
  profileUpdated: 'Профиль обновлён',
  eventCreated: 'Мероприятие создано',
  eventUpdated: 'Мероприятие обновлено',
  eventCancelled: 'Мероприятие отменено',
  joinedEvent: 'Вы записаны на мероприятие',
  leftEvent: 'Вы отменили участие',
  reviewSubmitted: 'Отзыв отправлен',
  subscriptionActivated: 'Подписка активирована',
  messageSent: 'Сообщение отправлено',
} as const;

// ============================================================================
// Date Format Config
// ============================================================================

export const DATE_FORMATS = {
  full: 'dd MMMM yyyy, HH:mm',
  date: 'dd MMMM yyyy',
  time: 'HH:mm',
  short: 'dd.MM.yyyy',
  dayMonth: 'd MMMM',
  weekday: 'EEEE',
  relative: 'relative', // Special marker for relative formatting
} as const;

// ============================================================================
// Theme Colors
// ============================================================================

export const THEME_COLORS = {
  primary: '#6366F1',
  primaryLight: '#818CF8',
  primaryDark: '#4F46E5',
  secondary: '#10B981',
  accent: '#F59E0B',
  error: '#EF4444',
  warning: '#F59E0B',
  success: '#10B981',
  info: '#3B82F6',
  background: '#F9FAFB',
  surface: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  divider: '#F3F4F6',
} as const;

// Re-export modules
export * from './categories';
export * from './cities';
