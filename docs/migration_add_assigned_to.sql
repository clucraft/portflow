-- Migration: Add assigned_to column to migrations table and update dashboard view
-- Run this on your PostgreSQL database

-- Add the assigned_to column
ALTER TABLE migrations
ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES team_members(id);

-- Recreate the dashboard view to include assigned_to and assignee name
DROP VIEW IF EXISTS migration_dashboard;

CREATE VIEW migration_dashboard AS
SELECT
    m.id,
    m.name,
    m.site_name,
    m.site_city,
    m.site_state,
    m.site_country,
    m.workflow_stage,
    m.target_carrier,
    m.routing_type,
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

    -- Creator info
    m.created_by,
    tm.display_name as created_by_name,

    -- Assignee info
    m.assigned_to,
    tm2.display_name as assigned_to_name,

    m.created_at,
    m.updated_at
FROM migrations m
LEFT JOIN team_members tm ON tm.id = m.created_by
LEFT JOIN team_members tm2 ON tm2.id = m.assigned_to
WHERE m.workflow_stage NOT IN ('cancelled');
