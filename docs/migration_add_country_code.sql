-- Migration: Add country_code column to migrations table
-- Run this on your PostgreSQL database to add the country_code field

-- Add the country_code column with a default of '+1' (US/Canada)
ALTER TABLE migrations
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT '+1';

-- Add a comment to document the column
COMMENT ON COLUMN migrations.country_code IS 'E.164 country code for phone number validation (e.g., +1, +44, +49)';

-- Update the migration_dashboard view to include country_code
DROP VIEW IF EXISTS migration_dashboard;

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
    m.country_code,
    m.telephone_users,
    m.is_porting_numbers,

    -- Estimate info
    m.estimate_total_monthly,
    m.estimate_total_onetime,
    m.estimate_accepted_at,

    -- Key dates
    m.verizon_request_submitted_at,
    m.verizon_setup_complete_at,
    m.loa_submitted_at,
    m.foc_date,
    m.scheduled_port_date,
    m.actual_port_date,
    m.completed_at,

    -- Counts
    m.total_numbers,
    m.ported_numbers,
    m.total_users,
    m.configured_users,

    -- Progress calculations
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
