-- ============================================================================
-- MeetUp.local Database Schema
-- Optimized for high load: 100K concurrent users, 10M registered, 10K events
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- For text search optimization

-- ============================================================================
-- ENUMS (for type safety and performance)
-- ============================================================================

CREATE TYPE subscription_type AS ENUM ('free', 'participant', 'organizer');
CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
CREATE TYPE event_status AS ENUM ('draft', 'published', 'cancelled', 'completed');
CREATE TYPE participant_status AS ENUM ('pending', 'approved', 'declined', 'cancelled', 'attended', 'no_show');
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'refunded');
CREATE TYPE payment_type AS ENUM ('pending', 'succeeded', 'cancelled', 'refunded');
CREATE TYPE review_type AS ENUM ('organizer_to_participant', 'participant_to_organizer');
CREATE TYPE notification_type AS ENUM (
  'event_reminder',
  'new_participant',
  'participant_approved',
  'participant_declined',
  'event_cancelled',
  'new_message',
  'new_review',
  'subscription_expiring',
  'ban_notification'
);

-- ============================================================================
-- PROFILES TABLE
-- Optimized for frequent reads and updates
-- ============================================================================

CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Basic info (frequently accessed)
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  birth_year INTEGER CHECK (birth_year >= 1900 AND birth_year <= EXTRACT(YEAR FROM NOW())),

  -- Location (critical for geo queries)
  city TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),

  -- Interests (array for filtering)
  interests TEXT[] DEFAULT '{}',

  -- Subscription (frequently checked)
  subscription_type subscription_type DEFAULT 'free',
  subscription_expires_at TIMESTAMPTZ,

  -- Metrics (updated frequently)
  rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 1.0 AND rating <= 5.0),
  reviews_count INTEGER DEFAULT 0,
  events_organized INTEGER DEFAULT 0,
  events_attended INTEGER DEFAULT 0,
  no_show_count INTEGER DEFAULT 0,

  -- Status
  is_verified BOOLEAN DEFAULT false,
  is_banned BOOLEAN DEFAULT false,
  banned_until TIMESTAMPTZ,

  -- Push notifications
  push_token TEXT,

  -- Activity tracking
  last_active_at TIMESTAMPTZ,

  -- Role
  role user_role DEFAULT 'user',

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT display_name_length CHECK (char_length(display_name) >= 2 AND char_length(display_name) <= 50),
  CONSTRAINT bio_length CHECK (bio IS NULL OR char_length(bio) <= 500)
);

-- Indexes for profiles (critical for 10M users)
CREATE INDEX idx_profiles_city ON profiles(city);
CREATE INDEX idx_profiles_subscription ON profiles(subscription_type) WHERE subscription_type != 'free';
CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX idx_profiles_rating ON profiles(rating DESC) WHERE is_banned = false;
CREATE INDEX idx_profiles_interests ON profiles USING GIN(interests);
CREATE INDEX idx_profiles_active ON profiles(last_active_at DESC) WHERE is_banned = false;
-- Partial index for non-banned active users (most common query pattern)
CREATE INDEX idx_profiles_active_users ON profiles(id)
  WHERE is_banned = false AND subscription_type != 'free';

-- ============================================================================
-- ACTIVITY CATEGORIES TABLE
-- Small table, heavily cached
-- ============================================================================

CREATE TABLE activity_categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  icon TEXT,
  color TEXT,
  parent_id UUID REFERENCES activity_categories(id) ON DELETE SET NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_categories_parent ON activity_categories(parent_id) WHERE is_active = true;
CREATE INDEX idx_categories_slug ON activity_categories(slug);

-- ============================================================================
-- EVENTS TABLE
-- Core table, heavily optimized for geo queries and filtering
-- ============================================================================

CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organizer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Basic info
  title TEXT NOT NULL,
  description TEXT,
  category_id UUID REFERENCES activity_categories(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}',
  cover_image_url TEXT,

  -- Time (critical for filtering)
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ,
  duration_minutes INTEGER,
  timezone TEXT DEFAULT 'Europe/Moscow',

  -- Location (critical for geo queries)
  location GEOGRAPHY(POINT, 4326) NOT NULL,
  address TEXT NOT NULL,
  place_name TEXT,
  place_details TEXT,
  city TEXT NOT NULL,

  -- Participants
  min_participants INTEGER DEFAULT 2 CHECK (min_participants >= 2),
  max_participants INTEGER CHECK (max_participants IS NULL OR max_participants >= min_participants),
  current_participants INTEGER DEFAULT 0 CHECK (current_participants >= 0),

  -- Settings
  is_public BOOLEAN DEFAULT true,
  requires_approval BOOLEAN DEFAULT false,
  allow_chat BOOLEAN DEFAULT true,

  -- Payment
  entry_fee DECIMAL(10,2) DEFAULT 0 CHECK (entry_fee >= 0),

  -- Status
  status event_status DEFAULT 'draft',
  cancelled_reason TEXT,

  -- Metrics
  views_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Constraints
  CONSTRAINT title_length CHECK (char_length(title) >= 5 AND char_length(title) <= 100),
  CONSTRAINT description_length CHECK (description IS NULL OR char_length(description) <= 2000),
  CONSTRAINT valid_dates CHECK (ends_at IS NULL OR ends_at > starts_at)
);

-- Indexes for events (critical for 10K concurrent events)
-- Primary discovery query: upcoming events near location
CREATE INDEX idx_events_discovery ON events(starts_at, city, status)
  WHERE status = 'published' AND starts_at > NOW();

-- Geo-spatial index (critical for "events near me")
CREATE INDEX idx_events_location ON events USING GIST(location);

-- Category filtering
CREATE INDEX idx_events_category ON events(category_id, starts_at)
  WHERE status = 'published';

-- Organizer's events
CREATE INDEX idx_events_organizer ON events(organizer_id, starts_at DESC);

-- Full-text search on title
CREATE INDEX idx_events_title_search ON events USING GIN(to_tsvector('russian', title));

-- Tags search
CREATE INDEX idx_events_tags ON events USING GIN(tags);

-- Composite index for common query pattern
CREATE INDEX idx_events_city_date_status ON events(city, starts_at, status)
  WHERE status = 'published';

-- Partial index for available events (has spots)
CREATE INDEX idx_events_available ON events(id, starts_at)
  WHERE status = 'published'
    AND (max_participants IS NULL OR current_participants < max_participants);

-- ============================================================================
-- EVENT PARTICIPANTS TABLE
-- High-volume join table, heavily optimized
-- ============================================================================

CREATE TABLE event_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  status participant_status DEFAULT 'pending',

  -- Payment for single-event access
  payment_id TEXT,
  payment_status payment_status,

  message_to_organizer TEXT,

  -- Timestamps
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,

  -- Unique constraint
  CONSTRAINT unique_event_participant UNIQUE(event_id, user_id),
  CONSTRAINT message_length CHECK (message_to_organizer IS NULL OR char_length(message_to_organizer) <= 500)
);

-- Indexes for event_participants
-- Get participants for an event
CREATE INDEX idx_participants_event ON event_participants(event_id, status);

-- Get user's events
CREATE INDEX idx_participants_user ON event_participants(user_id, status);

-- Composite for checking existing participation
CREATE INDEX idx_participants_event_user ON event_participants(event_id, user_id);

-- For counting approved participants
CREATE INDEX idx_participants_approved ON event_participants(event_id)
  WHERE status = 'approved';

-- ============================================================================
-- REVIEWS TABLE
-- ============================================================================

CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reviewee_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  review_type review_type NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate reviews
  CONSTRAINT unique_review UNIQUE(event_id, reviewer_id, reviewee_id),
  CONSTRAINT comment_length CHECK (comment IS NULL OR char_length(comment) <= 1000)
);

-- Indexes for reviews
CREATE INDEX idx_reviews_reviewee ON reviews(reviewee_id, created_at DESC);
CREATE INDEX idx_reviews_event ON reviews(event_id);
CREATE INDEX idx_reviews_reviewer ON reviews(reviewer_id);

-- ============================================================================
-- EVENT MESSAGES TABLE (Chat)
-- High-volume table for real-time chat
-- ============================================================================

CREATE TABLE event_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  content TEXT NOT NULL,
  is_system BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT content_length CHECK (char_length(content) <= 500)
);

-- Index for fetching messages (ordered by time)
CREATE INDEX idx_messages_event ON event_messages(event_id, created_at);

-- Partition strategy consideration for messages:
-- For 10K events with ~50 messages each = 500K messages
-- Consider partitioning by event_id range if volume exceeds 10M

-- ============================================================================
-- APP SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE app_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type subscription_type NOT NULL CHECK (type != 'free'),

  starts_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,

  payment_id TEXT,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),

  is_active BOOLEAN DEFAULT true,
  auto_renew BOOLEAN DEFAULT true,

  created_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT valid_subscription_dates CHECK (expires_at > starts_at)
);

-- Index for subscription checks
CREATE INDEX idx_subscriptions_user ON app_subscriptions(user_id, expires_at DESC);
CREATE INDEX idx_subscriptions_expiring ON app_subscriptions(expires_at)
  WHERE is_active = true AND auto_renew = true;

-- ============================================================================
-- EVENT PAYMENTS TABLE
-- ============================================================================

CREATE TABLE event_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),

  yookassa_payment_id TEXT,
  status payment_type DEFAULT 'pending',

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for payment lookups
CREATE INDEX idx_event_payments_user ON event_payments(user_id);
CREATE INDEX idx_event_payments_event ON event_payments(event_id);
CREATE INDEX idx_event_payments_yookassa ON event_payments(yookassa_payment_id);

-- ============================================================================
-- SAVED EVENTS TABLE (Favorites)
-- ============================================================================

CREATE TABLE saved_events (
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  event_id UUID REFERENCES events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, event_id)
);

-- Index for user's saved events
CREATE INDEX idx_saved_events_user ON saved_events(user_id, created_at DESC);

-- ============================================================================
-- NOTIFICATIONS TABLE
-- High-volume, consider archival strategy
-- ============================================================================

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type notification_type NOT NULL,
  title TEXT NOT NULL,
  body TEXT,

  data JSONB DEFAULT '{}',

  is_read BOOLEAN DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for notifications
CREATE INDEX idx_notifications_user ON notifications(user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications(user_id)
  WHERE is_read = false;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment participant count
CREATE OR REPLACE FUNCTION increment_participants(p_event_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE events
  SET current_participants = current_participants + 1
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement participant count
CREATE OR REPLACE FUNCTION decrement_participants(p_event_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE events
  SET current_participants = GREATEST(0, current_participants - 1)
  WHERE id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function to increment no-show count
CREATE OR REPLACE FUNCTION increment_no_show(p_user_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET no_show_count = no_show_count + 1
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to recalculate user rating
CREATE OR REPLACE FUNCTION recalculate_rating(p_user_id UUID)
RETURNS void AS $$
DECLARE
  new_rating DECIMAL(3,2);
  new_count INTEGER;
BEGIN
  SELECT COALESCE(AVG(rating), 5.0), COUNT(*)
  INTO new_rating, new_count
  FROM reviews
  WHERE reviewee_id = p_user_id;

  UPDATE profiles
  SET rating = new_rating, reviews_count = new_count
  WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GEO SEARCH FUNCTION (optimized for high load)
-- ============================================================================

CREATE OR REPLACE FUNCTION search_events_nearby(
  p_latitude FLOAT,
  p_longitude FLOAT,
  p_distance_meters FLOAT,
  p_category_id UUID DEFAULT NULL,
  p_date_from TIMESTAMPTZ DEFAULT NOW(),
  p_date_to TIMESTAMPTZ DEFAULT NULL,
  p_city TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 20,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title TEXT,
  description TEXT,
  category_id UUID,
  starts_at TIMESTAMPTZ,
  location GEOGRAPHY,
  address TEXT,
  place_name TEXT,
  city TEXT,
  current_participants INTEGER,
  max_participants INTEGER,
  organizer_id UUID,
  distance_meters FLOAT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.description,
    e.category_id,
    e.starts_at,
    e.location,
    e.address,
    e.place_name,
    e.city,
    e.current_participants,
    e.max_participants,
    e.organizer_id,
    ST_Distance(
      e.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
    ) as distance_meters
  FROM events e
  WHERE
    e.status = 'published'
    AND e.starts_at >= p_date_from
    AND (p_date_to IS NULL OR e.starts_at <= p_date_to)
    AND (p_category_id IS NULL OR e.category_id = p_category_id)
    AND (p_city IS NULL OR e.city = p_city)
    AND ST_DWithin(
      e.location,
      ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
      p_distance_meters
    )
    AND (e.max_participants IS NULL OR e.current_participants < e.max_participants)
  ORDER BY
    distance_meters ASC,
    e.starts_at ASC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE saved_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- Categories policies (read-only for all)
CREATE POLICY "Categories are viewable by everyone"
  ON activity_categories FOR SELECT
  USING (true);

-- Events policies
CREATE POLICY "Published events are viewable by everyone"
  ON events FOR SELECT
  USING (status = 'published' OR organizer_id = auth.uid());

CREATE POLICY "Authenticated users can create events"
  ON events FOR INSERT
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can update own events"
  ON events FOR UPDATE
  USING (auth.uid() = organizer_id)
  WITH CHECK (auth.uid() = organizer_id);

CREATE POLICY "Organizers can delete own events"
  ON events FOR DELETE
  USING (auth.uid() = organizer_id);

-- Event participants policies
CREATE POLICY "Participants visible to event members"
  ON event_participants FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_participants ep
      WHERE ep.event_id = event_participants.event_id
        AND ep.user_id = auth.uid()
        AND ep.status = 'approved'
    )
  );

CREATE POLICY "Users can join events"
  ON event_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own participation"
  ON event_participants FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (
    SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
  ));

-- Reviews policies
CREATE POLICY "Reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (true);

CREATE POLICY "Users can create reviews for events they attended"
  ON reviews FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = reviews.event_id
        AND user_id = auth.uid()
        AND status = 'attended'
    )
  );

-- Messages policies
CREATE POLICY "Messages visible to event participants"
  ON event_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM event_participants
      WHERE event_id = event_messages.event_id
        AND user_id = auth.uid()
        AND status = 'approved'
    )
  );

CREATE POLICY "Participants can send messages"
  ON event_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (
      EXISTS (
        SELECT 1 FROM events WHERE id = event_id AND organizer_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM event_participants
        WHERE event_id = event_messages.event_id
          AND user_id = auth.uid()
          AND status = 'approved'
      )
    )
  );

-- Subscriptions policies
CREATE POLICY "Users can view own subscriptions"
  ON app_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can create subscriptions"
  ON app_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Payments policies
CREATE POLICY "Users can view own payments"
  ON event_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Saved events policies
CREATE POLICY "Users can view own saved events"
  ON saved_events FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can save events"
  ON saved_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unsave events"
  ON saved_events FOR DELETE
  USING (auth.uid() = user_id);

-- Notifications policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- REALTIME SUBSCRIPTIONS
-- ============================================================================

-- Enable realtime for chat messages
ALTER PUBLICATION supabase_realtime ADD TABLE event_messages;

-- Enable realtime for participant updates
ALTER PUBLICATION supabase_realtime ADD TABLE event_participants;

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
