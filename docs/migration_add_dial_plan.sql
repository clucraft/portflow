-- Add dial_plan column for Grant-CsTenantDialPlan assignment
-- Applies to both Direct Routing and Operator Connect migrations
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS dial_plan TEXT;
