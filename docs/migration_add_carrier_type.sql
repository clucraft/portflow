-- Migration: Add carrier_type to carriers, convert routing_type from enum to text
-- Date: 2025-02-11

-- 1. Add carrier_type to carriers table
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS carrier_type VARCHAR(30) NOT NULL DEFAULT 'direct_routing';

-- 2. Convert routing_type from enum to text (to support 'calling_plan')
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS routing_type_text TEXT;
UPDATE migrations SET routing_type_text = routing_type::TEXT WHERE routing_type_text IS NULL;
ALTER TABLE migrations DROP COLUMN IF EXISTS routing_type;
ALTER TABLE migrations RENAME COLUMN routing_type_text TO routing_type;
ALTER TABLE migrations ALTER COLUMN routing_type SET DEFAULT 'direct_routing';
