-- PortFlow Settings Round 2: Carriers + Pre-defined Policies/Dial Plans
-- Run this migration against your portflow database

-- Create carriers table
CREATE TABLE IF NOT EXISTS carriers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(100) NOT NULL UNIQUE,
  display_name VARCHAR(200) NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default carriers
INSERT INTO carriers (slug, display_name, sort_order) VALUES
  ('verizon', 'Verizon', 1),
  ('fusionconnect', 'FusionConnect', 2),
  ('gtt', 'GTT', 3)
ON CONFLICT (slug) DO NOTHING;

-- Create voice_routing_policies table
CREATE TABLE IF NOT EXISTS voice_routing_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create dial_plans table
CREATE TABLE IF NOT EXISTS dial_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert migrations.target_carrier from ENUM to TEXT
-- Step 1: Add a new text column
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS target_carrier_text TEXT;

-- Step 2: Copy data from enum column to text column
UPDATE migrations SET target_carrier_text = target_carrier::TEXT WHERE target_carrier_text IS NULL;

-- Step 3: Drop the enum column and rename
ALTER TABLE migrations DROP COLUMN IF EXISTS target_carrier;
ALTER TABLE migrations RENAME COLUMN target_carrier_text TO target_carrier;

-- Set a default value
ALTER TABLE migrations ALTER COLUMN target_carrier SET DEFAULT 'verizon';

-- Recreate the migration_dashboard view
CREATE OR REPLACE VIEW migration_dashboard AS
SELECT
  m.*,
  CASE m.workflow_stage
    WHEN 'estimate' THEN 1
    WHEN 'estimate_accepted' THEN 2
    WHEN 'verizon_submitted' THEN 3
    WHEN 'verizon_in_progress' THEN 4
    WHEN 'verizon_complete' THEN 5
    WHEN 'porting_submitted' THEN 6
    WHEN 'porting_scheduled' THEN 7
    WHEN 'porting_complete' THEN 8
    WHEN 'user_config' THEN 9
    WHEN 'completed' THEN 10
    ELSE 0
  END AS stage_number
FROM migrations m;

-- Drop the old enum type if it exists (safe because column is now TEXT)
DROP TYPE IF EXISTS target_carrier;
