-- Update subscription for test user us89@mail.ru
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/YOUR_PROJECT/sql

-- Step 1: Confirm email for the user (allows login with session)
-- Note: confirmed_at is a generated column, only update email_confirmed_at
UPDATE auth.users
SET
  email_confirmed_at = NOW()
WHERE email = 'us89@mail.ru';

-- Step 2: Update profile to organizer subscription
UPDATE profiles
SET
  subscription_type = 'organizer',
  subscription_expires_at = NOW() + INTERVAL '1 year',
  is_verified = true
WHERE id IN (
  SELECT id FROM auth.users WHERE email = 'us89@mail.ru'
);

-- Step 3: Create subscription record
INSERT INTO app_subscriptions (user_id, type, starts_at, expires_at, amount, is_active)
SELECT
  id,
  'organizer',
  NOW(),
  NOW() + INTERVAL '1 year',
  0.00,
  true
FROM auth.users WHERE email = 'us89@mail.ru'
ON CONFLICT DO NOTHING;

-- Verify the update
SELECT
  p.id,
  u.email,
  u.email_confirmed_at,
  p.display_name,
  p.subscription_type,
  p.subscription_expires_at,
  p.is_verified
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'us89@mail.ru';
