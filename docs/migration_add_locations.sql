-- Migration: Add Locations master list
-- Holds the global Teams EV project roster. Each location can optionally link
-- to a PortFlow migration project (1:1) when work begins.

CREATE TABLE IF NOT EXISTS locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Identity
    site_code TEXT UNIQUE NOT NULL,
    location_name TEXT NOT NULL,
    region TEXT,                       -- AMER / EMEA / APAC (manual)
    country TEXT,                      -- optional
    company TEXT,                      -- legal entity / company

    -- Sizing
    estimated_users INTEGER DEFAULT 0,

    -- Triage
    priority TEXT,                     -- e.g. High / Medium / Low
    complexity TEXT,                   -- e.g. High / Medium / Low
    complexity_reasons TEXT,

    -- People
    assigned_engineer TEXT,
    local_it_contact TEXT,

    -- Planned + historical dates
    planned_start_date DATE,
    planned_end_date DATE,
    verizon_request_submitted_date DATE,
    setup_complete_date DATE,
    kickoff_with_it_date DATE,
    kickoff_complete_date DATE,
    port_scheduling_submitted_date DATE,
    port_complete_date DATE,
    hypercare_start_date DATE,
    hypercare_end_date DATE,

    notes TEXT,

    -- planned / in_progress / completed / on_hold / cancelled / out_of_scope
    status TEXT NOT NULL DEFAULT 'planned',

    -- Optional link to a PortFlow migration project
    migration_id UUID REFERENCES migrations(id) ON DELETE SET NULL,

    created_by UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_locations_site_code ON locations(site_code);
CREATE INDEX IF NOT EXISTS idx_locations_status ON locations(status);
CREATE INDEX IF NOT EXISTS idx_locations_region ON locations(region);
CREATE INDEX IF NOT EXISTS idx_locations_migration ON locations(migration_id);

CREATE TRIGGER update_locations_updated_at BEFORE UPDATE ON locations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
