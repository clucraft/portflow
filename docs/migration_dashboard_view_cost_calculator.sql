-- Recreate migration_dashboard view to include cost_calculator
-- Needed so the frontend's effectiveUserCount() helper can fall back to
-- cost_calculator.total_users when the end_users list is empty.

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

    -- Phase tasks
    m.phase_tasks,

    -- Cost calculator (for effectiveUserCount fallback)
    m.cost_calculator,

    -- On hold info
    m.on_hold_previous_stage,
    m.on_hold_reason,
    m.on_hold_at,

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
