-- Migration: Add carrier_type to carriers, convert routing_type from enum to text
-- Date: 2025-02-11

-- 1. Add carrier_type to carriers table
ALTER TABLE carriers ADD COLUMN IF NOT EXISTS carrier_type VARCHAR(30) NOT NULL DEFAULT 'direct_routing';

-- 2. Convert routing_type from enum to text (to support 'calling_plan')
--    Must drop/recreate migration_dashboard view which depends on routing_type
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS routing_type_text TEXT;
UPDATE migrations SET routing_type_text = routing_type::TEXT WHERE routing_type_text IS NULL;

DROP VIEW IF EXISTS migration_dashboard CASCADE;

ALTER TABLE migrations DROP COLUMN IF EXISTS routing_type;
ALTER TABLE migrations RENAME COLUMN routing_type_text TO routing_type;
ALTER TABLE migrations ALTER COLUMN routing_type SET DEFAULT 'direct_routing';

-- 3. Recreate the migration_dashboard view
CREATE VIEW migration_dashboard AS
SELECT
    m.id,
    m.name,
    m.site_name,
    m.site_city,
    m.site_country,
    m.workflow_stage,
    m.target_carrier,
    m.routing_type,
    m.telephone_users,
    m.is_porting_numbers,
    m.estimate_total_monthly,
    m.estimate_total_onetime,
    m.estimate_accepted_at,
    m.verizon_request_submitted_at,
    m.verizon_setup_complete_at,
    m.loa_submitted_at,
    m.foc_date,
    m.scheduled_port_date,
    m.actual_port_date,
    m.completed_at,
    m.total_numbers,
    m.ported_numbers,
    m.total_users,
    m.configured_users,
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
    END as stage_number,
    m.created_at,
    m.updated_at
FROM migrations m
WHERE m.workflow_stage NOT IN ('cancelled');
