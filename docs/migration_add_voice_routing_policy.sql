-- Add voice_routing_policy column to migrations table
-- Only applicable when routing_type = 'direct_routing'
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS voice_routing_policy TEXT;

-- Recreate the migration_dashboard view to include the new column
DROP VIEW IF EXISTS migration_dashboard;
CREATE VIEW migration_dashboard AS
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
  END as stage_number
FROM migrations m;
