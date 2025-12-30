/**
 * Services Index
 * Re-exports all services for convenient imports
 */

// Supabase services
export * from './supabase/client';
export * from './supabase/auth.service';
export * from './supabase/events.service';
export * from './supabase/profiles.service';
export * from './supabase/chat.service';
export * from './supabase/reviews.service';

// Location services
export * from './location/yandex-maps.service';

// Payment services
export * from './payments/alfa-acquiring.service';

// Notification services
export * from './notifications/push.service';
