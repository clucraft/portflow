-- PortFlow Settings Round 1: Authentication + User Management
-- Run this migration against your portflow database

-- Add password_hash column to team_members
ALTER TABLE team_members ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Create app_settings table for key-value configuration
CREATE TABLE IF NOT EXISTS app_settings (
  key VARCHAR(100) PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES team_members(id) ON DELETE SET NULL
);
