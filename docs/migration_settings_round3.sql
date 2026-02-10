-- PortFlow Settings Round 3: Email Relay + Notifications
-- Run this migration against your portflow database

-- Create notification_subscriptions table
CREATE TABLE IF NOT EXISTS notification_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(team_member_id, migration_id)
);
