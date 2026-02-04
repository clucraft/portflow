-- PortFlow Database Schema
-- PostgreSQL 15+
-- Enterprise Voice Migration Management

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

CREATE TYPE migration_status AS ENUM (
    'planning',
    'discovery',
    'data_collection',
    'in_progress',
    'porting',
    'testing',
    'completed',
    'on_hold',
    'cancelled'
);

CREATE TYPE target_carrier AS ENUM (
    'verizon',
    'fusionconnect',
    'gtt'
);

CREATE TYPE routing_type AS ENUM (
    'direct_routing',
    'operator_connect'
);

CREATE TYPE phone_number_type AS ENUM (
    'user',
    'auto_attendant',
    'call_queue',
    'fax',
    'conference_room',
    'shared',
    'other'
);

CREATE TYPE porting_status AS ENUM (
    'not_started',
    'loa_submitted',
    'loa_rejected',
    'foc_received',
    'port_scheduled',
    'ported',
    'verified',
    'failed'
);

CREATE TYPE resource_account_type AS ENUM (
    'auto_attendant',
    'call_queue'
);

CREATE TYPE cq_routing_method AS ENUM (
    'attendant',
    'serial',
    'round_robin',
    'longest_idle'
);

CREATE TYPE overflow_action AS ENUM (
    'disconnect',
    'forward_external',
    'forward_user',
    'voicemail',
    'shared_voicemail'
);

CREATE TYPE team_role AS ENUM (
    'admin',
    'member',
    'viewer'
);

-- ============================================================================
-- TEAM MEMBERS (users of PortFlow app)
-- ============================================================================

CREATE TABLE team_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    role team_role NOT NULL DEFAULT 'member',
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_team_members_email ON team_members(email);

-- ============================================================================
-- SITES (physical locations being migrated)
-- ============================================================================

CREATE TABLE sites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    site_code VARCHAR(50), -- optional internal code (e.g., "NYC-HQ", "LON-01")

    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country VARCHAR(100) NOT NULL,

    timezone VARCHAR(100) NOT NULL, -- IANA timezone (e.g., "America/New_York")

    -- Current PBX info
    current_pbx_type VARCHAR(100), -- e.g., "Avaya", "Cisco UCM", "Mitel", "Legacy analog"
    current_pbx_model VARCHAR(100),
    current_carrier VARCHAR(100),

    -- Contact info
    main_site_number VARCHAR(50), -- main published number for the site
    site_contact_name VARCHAR(255),
    site_contact_email VARCHAR(255),
    site_contact_phone VARCHAR(50),

    -- Business hours (flexible JSON structure)
    -- Format: { "monday": { "open": "08:00", "close": "17:00" }, "tuesday": {...}, ... }
    business_hours JSONB,

    -- Holidays observed
    -- Format: [{ "name": "Christmas", "date": "2024-12-25" }, ...]
    holidays JSONB,

    notes TEXT,

    created_by UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sites_country ON sites(country);
CREATE INDEX idx_sites_name ON sites(name);

-- ============================================================================
-- MIGRATIONS (a migration project for a site)
-- ============================================================================

CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL, -- e.g., "NYC Office Migration - Q1 2024"
    status migration_status NOT NULL DEFAULT 'planning',

    -- Carrier and routing
    target_carrier target_carrier NOT NULL,
    routing_type routing_type NOT NULL,

    -- Key dates
    discovery_start_date DATE,
    data_collection_deadline DATE,
    target_port_date DATE,
    actual_port_date DATE,
    go_live_date DATE,
    completed_date DATE,

    -- Summary counts (denormalized for dashboard performance)
    total_numbers INTEGER DEFAULT 0,
    ported_numbers INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    configured_users INTEGER DEFAULT 0,

    notes TEXT,

    created_by UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_migrations_site ON migrations(site_id);
CREATE INDEX idx_migrations_status ON migrations(status);
CREATE INDEX idx_migrations_target_date ON migrations(target_port_date);

-- ============================================================================
-- MIGRATION TEAM ASSIGNMENTS
-- ============================================================================

CREATE TABLE migration_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    team_member_id UUID NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member', -- 'lead', 'member'
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    assigned_by UUID REFERENCES team_members(id),

    UNIQUE(migration_id, team_member_id)
);

CREATE INDEX idx_migration_assignments_migration ON migration_assignments(migration_id);
CREATE INDEX idx_migration_assignments_member ON migration_assignments(team_member_id);

-- ============================================================================
-- END USERS (employees receiving phone numbers)
-- ============================================================================

CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    -- Identity
    display_name VARCHAR(255) NOT NULL,
    upn VARCHAR(255) NOT NULL, -- user principal name (email)
    azure_ad_object_id VARCHAR(100), -- for Graph API integration later

    -- Org info
    department VARCHAR(255),
    job_title VARCHAR(255),
    manager_upn VARCHAR(255),

    -- Licensing
    has_teams_phone_license BOOLEAN DEFAULT false,
    license_type VARCHAR(100), -- e.g., "Microsoft 365 E5", "Teams Phone Standard"

    -- Voice config
    voice_routing_policy VARCHAR(255), -- for Direct Routing
    dial_plan VARCHAR(255),

    -- Status tracking
    is_configured BOOLEAN DEFAULT false, -- number assigned and verified
    configuration_date TIMESTAMPTZ,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(migration_id, upn)
);

CREATE INDEX idx_end_users_migration ON end_users(migration_id);
CREATE INDEX idx_end_users_site ON end_users(site_id);
CREATE INDEX idx_end_users_upn ON end_users(upn);
CREATE INDEX idx_end_users_configured ON end_users(is_configured);

-- ============================================================================
-- RESOURCE ACCOUNTS (for Auto Attendants and Call Queues)
-- ============================================================================

CREATE TABLE resource_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    upn VARCHAR(255) NOT NULL, -- e.g., "ra-mainline-aa@contoso.com"
    display_name VARCHAR(255) NOT NULL,
    account_type resource_account_type NOT NULL,

    -- Azure AD status
    azure_ad_object_id VARCHAR(100),
    is_created_in_azure BOOLEAN DEFAULT false,

    -- Licensing
    is_licensed BOOLEAN DEFAULT false,
    license_type VARCHAR(100), -- "Microsoft Teams Phone Resource Account"

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(migration_id, upn)
);

CREATE INDEX idx_resource_accounts_migration ON resource_accounts(migration_id);
CREATE INDEX idx_resource_accounts_type ON resource_accounts(account_type);

-- ============================================================================
-- PHONE NUMBERS (DIDs being ported)
-- ============================================================================

CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    -- Number in E.164 format (e.g., "+12125551234")
    number VARCHAR(50) NOT NULL,
    number_type phone_number_type NOT NULL DEFAULT 'user',

    -- Original carrier info
    original_carrier VARCHAR(100),
    original_account_number VARCHAR(100),
    original_pin VARCHAR(50), -- for LOA

    -- Porting workflow
    porting_status porting_status NOT NULL DEFAULT 'not_started',
    loa_submitted_date DATE,
    loa_rejection_reason TEXT,
    foc_date DATE, -- Firm Order Commitment date
    port_date DATE, -- actual scheduled port date
    ported_date DATE, -- when it actually ported
    verified_date DATE,

    -- Assignment (one of these, not both)
    assigned_user_id UUID REFERENCES end_users(id) ON DELETE SET NULL,
    assigned_resource_account_id UUID REFERENCES resource_accounts(id) ON DELETE SET NULL,

    -- For Direct Routing
    online_voice_routing_policy VARCHAR(255),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(number),

    -- Ensure number is assigned to only one entity
    CONSTRAINT chk_single_assignment CHECK (
        (assigned_user_id IS NULL OR assigned_resource_account_id IS NULL)
    )
);

CREATE INDEX idx_phone_numbers_migration ON phone_numbers(migration_id);
CREATE INDEX idx_phone_numbers_site ON phone_numbers(site_id);
CREATE INDEX idx_phone_numbers_status ON phone_numbers(porting_status);
CREATE INDEX idx_phone_numbers_type ON phone_numbers(number_type);
CREATE INDEX idx_phone_numbers_user ON phone_numbers(assigned_user_id);
CREATE INDEX idx_phone_numbers_resource ON phone_numbers(assigned_resource_account_id);
CREATE INDEX idx_phone_numbers_foc ON phone_numbers(foc_date);
CREATE INDEX idx_phone_numbers_port ON phone_numbers(port_date);

-- ============================================================================
-- AUTO ATTENDANTS
-- ============================================================================

CREATE TABLE auto_attendants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    resource_account_id UUID REFERENCES resource_accounts(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,

    -- General settings
    language_id VARCHAR(20) NOT NULL DEFAULT 'en-US',
    timezone VARCHAR(100) NOT NULL,
    voice_id VARCHAR(100), -- TTS voice

    -- Business hours greeting
    business_hours_greeting_type VARCHAR(20) DEFAULT 'text', -- 'text', 'audio_file', 'none'
    business_hours_greeting_text TEXT,
    business_hours_greeting_file_path VARCHAR(500),

    -- Business hours menu options
    -- Format: [{ "key": "1", "action": "transfer_user", "target": "user@contoso.com", "prompt": "Press 1 for Sales" }, ...]
    business_hours_menu_options JSONB,

    -- After hours greeting
    after_hours_greeting_type VARCHAR(20) DEFAULT 'text',
    after_hours_greeting_text TEXT,
    after_hours_greeting_file_path VARCHAR(500),

    -- After hours menu options
    after_hours_menu_options JSONB,
    after_hours_action VARCHAR(50) DEFAULT 'disconnect', -- 'disconnect', 'transfer', 'voicemail'
    after_hours_target VARCHAR(255),

    -- Schedule (overrides site business hours if set)
    -- Format: { "monday": { "ranges": [{"start": "08:00", "end": "12:00"}, {"start": "13:00", "end": "17:00"}] }, ... }
    business_hours_schedule JSONB,

    -- Holiday handling
    -- Format: [{ "name": "Christmas", "date_range": {"start": "2024-12-25", "end": "2024-12-25"}, "greeting_text": "...", "action": "disconnect" }, ...]
    holiday_schedules JSONB,

    -- Operator option
    operator_enabled BOOLEAN DEFAULT false,
    operator_target_type VARCHAR(50), -- 'user', 'external_number', 'voicemail'
    operator_target_value VARCHAR(255),

    -- Directory search
    directory_search_enabled BOOLEAN DEFAULT false,
    directory_search_method VARCHAR(50), -- 'dial_by_name', 'dial_by_extension'
    directory_search_scope JSONB, -- groups/OUs to include

    -- Nested AA (call another AA)
    parent_auto_attendant_id UUID REFERENCES auto_attendants(id),

    -- Status
    is_deployed BOOLEAN DEFAULT false,
    deployed_at TIMESTAMPTZ,
    teams_aa_id VARCHAR(100), -- ID from Teams after deployment

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_attendants_migration ON auto_attendants(migration_id);
CREATE INDEX idx_auto_attendants_site ON auto_attendants(site_id);
CREATE INDEX idx_auto_attendants_resource ON auto_attendants(resource_account_id);

-- ============================================================================
-- CALL QUEUES
-- ============================================================================

CREATE TABLE call_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,
    site_id UUID NOT NULL REFERENCES sites(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    resource_account_id UUID REFERENCES resource_accounts(id) ON DELETE SET NULL,
    phone_number_id UUID REFERENCES phone_numbers(id) ON DELETE SET NULL,

    -- General settings
    language_id VARCHAR(20) NOT NULL DEFAULT 'en-US',

    -- Greeting
    greeting_type VARCHAR(20) DEFAULT 'none', -- 'none', 'text', 'audio_file'
    greeting_text TEXT,
    greeting_file_path VARCHAR(500),

    -- Music on hold
    music_on_hold_type VARCHAR(20) DEFAULT 'default', -- 'default', 'audio_file'
    music_on_hold_file_path VARCHAR(500),

    -- Routing
    routing_method cq_routing_method NOT NULL DEFAULT 'attendant',
    presence_based_routing BOOLEAN DEFAULT true,
    conference_mode BOOLEAN DEFAULT true, -- improves connection time

    -- Agent settings
    agent_alert_time INTEGER DEFAULT 30, -- seconds before moving to next agent
    allow_opt_out BOOLEAN DEFAULT true,

    -- Overflow handling
    overflow_threshold INTEGER DEFAULT 50, -- max callers in queue
    overflow_action overflow_action DEFAULT 'disconnect',
    overflow_target_type VARCHAR(50), -- 'user', 'external_number', 'voicemail', 'shared_voicemail'
    overflow_target_value VARCHAR(255),
    overflow_shared_voicemail_greeting_text TEXT,
    overflow_shared_voicemail_transcription BOOLEAN DEFAULT true,

    -- Timeout handling
    timeout_threshold INTEGER DEFAULT 1200, -- seconds (20 min default)
    timeout_action overflow_action DEFAULT 'disconnect',
    timeout_target_type VARCHAR(50),
    timeout_target_value VARCHAR(255),
    timeout_shared_voicemail_greeting_text TEXT,
    timeout_shared_voicemail_transcription BOOLEAN DEFAULT true,

    -- No agents handling
    no_agents_action overflow_action DEFAULT 'disconnect',
    no_agents_target_type VARCHAR(50),
    no_agents_target_value VARCHAR(255),

    -- Status
    is_deployed BOOLEAN DEFAULT false,
    deployed_at TIMESTAMPTZ,
    teams_cq_id VARCHAR(100), -- ID from Teams after deployment

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_queues_migration ON call_queues(migration_id);
CREATE INDEX idx_call_queues_site ON call_queues(site_id);
CREATE INDEX idx_call_queues_resource ON call_queues(resource_account_id);

-- ============================================================================
-- CALL QUEUE AGENTS (join table)
-- ============================================================================

CREATE TABLE call_queue_agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_queue_id UUID NOT NULL REFERENCES call_queues(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES end_users(id) ON DELETE CASCADE,

    is_opted_in BOOLEAN DEFAULT true,
    added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(call_queue_id, user_id)
);

CREATE INDEX idx_cq_agents_queue ON call_queue_agents(call_queue_id);
CREATE INDEX idx_cq_agents_user ON call_queue_agents(user_id);

-- ============================================================================
-- ACTIVITY LOG (audit trail)
-- ============================================================================

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Who
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,
    team_member_email VARCHAR(255), -- denormalized in case member deleted

    -- What entity
    entity_type VARCHAR(50) NOT NULL, -- 'site', 'migration', 'end_user', 'phone_number', etc.
    entity_id UUID NOT NULL,
    entity_name VARCHAR(255), -- human-readable name for display

    -- What action
    action VARCHAR(50) NOT NULL, -- 'created', 'updated', 'deleted', 'status_changed', 'imported', 'exported'

    -- Details of change
    -- Format: { "field": "status", "old_value": "planning", "new_value": "in_progress" }
    changes JSONB,

    -- Context
    migration_id UUID REFERENCES migrations(id) ON DELETE SET NULL, -- for filtering
    ip_address VARCHAR(50),
    user_agent TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_entity ON activity_log(entity_type, entity_id);
CREATE INDEX idx_activity_log_migration ON activity_log(migration_id);
CREATE INDEX idx_activity_log_member ON activity_log(team_member_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);
CREATE INDEX idx_activity_log_action ON activity_log(action);

-- ============================================================================
-- IMPORT BATCHES (track CSV/Excel imports)
-- ============================================================================

CREATE TABLE import_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    import_type VARCHAR(50) NOT NULL, -- 'users', 'phone_numbers', 'both'
    original_filename VARCHAR(255),

    -- Stats
    total_rows INTEGER DEFAULT 0,
    successful_rows INTEGER DEFAULT 0,
    failed_rows INTEGER DEFAULT 0,

    -- Error details
    -- Format: [{ "row": 5, "error": "Invalid phone number format", "data": {...} }, ...]
    errors JSONB,

    imported_by UUID REFERENCES team_members(id),
    imported_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_import_batches_migration ON import_batches(migration_id);

-- ============================================================================
-- GENERATED SCRIPTS (store generated PowerShell for reference)
-- ============================================================================

CREATE TABLE generated_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    script_type VARCHAR(50) NOT NULL, -- 'user_assignment', 'auto_attendant', 'call_queue', 'resource_account', 'full_migration'
    name VARCHAR(255) NOT NULL,
    description TEXT,

    script_content TEXT NOT NULL,

    -- Execution tracking
    was_executed BOOLEAN DEFAULT false,
    executed_at TIMESTAMPTZ,
    executed_by UUID REFERENCES team_members(id),
    execution_notes TEXT,

    generated_by UUID REFERENCES team_members(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_scripts_migration ON generated_scripts(migration_id);
CREATE INDEX idx_generated_scripts_type ON generated_scripts(script_type);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all relevant tables
CREATE TRIGGER update_team_members_updated_at BEFORE UPDATE ON team_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sites_updated_at BEFORE UPDATE ON sites FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_migrations_updated_at BEFORE UPDATE ON migrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_end_users_updated_at BEFORE UPDATE ON end_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resource_accounts_updated_at BEFORE UPDATE ON resource_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_attendants_updated_at BEFORE UPDATE ON auto_attendants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_queues_updated_at BEFORE UPDATE ON call_queues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update migration summary counts
CREATE OR REPLACE FUNCTION update_migration_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update counts on the migration
    UPDATE migrations SET
        total_numbers = (SELECT COUNT(*) FROM phone_numbers WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id)),
        ported_numbers = (SELECT COUNT(*) FROM phone_numbers WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id) AND porting_status IN ('ported', 'verified')),
        total_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id)),
        configured_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id) AND is_configured = true)
    WHERE id = COALESCE(NEW.migration_id, OLD.migration_id);

    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for count updates
CREATE TRIGGER update_counts_phone_numbers AFTER INSERT OR UPDATE OR DELETE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION update_migration_counts();
CREATE TRIGGER update_counts_end_users AFTER INSERT OR UPDATE OR DELETE ON end_users FOR EACH ROW EXECUTE FUNCTION update_migration_counts();

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- Migration dashboard view
CREATE VIEW migration_dashboard AS
SELECT
    m.id,
    m.name,
    m.status,
    m.target_carrier,
    m.routing_type,
    m.target_port_date,
    m.total_numbers,
    m.ported_numbers,
    m.total_users,
    m.configured_users,
    s.name as site_name,
    s.city,
    s.country,
    CASE
        WHEN m.total_numbers > 0 THEN ROUND((m.ported_numbers::DECIMAL / m.total_numbers) * 100, 1)
        ELSE 0
    END as porting_progress_pct,
    CASE
        WHEN m.total_users > 0 THEN ROUND((m.configured_users::DECIMAL / m.total_users) * 100, 1)
        ELSE 0
    END as user_config_progress_pct
FROM migrations m
JOIN sites s ON m.site_id = s.id;

-- Porting status summary view
CREATE VIEW porting_status_summary AS
SELECT
    m.id as migration_id,
    m.name as migration_name,
    pn.porting_status,
    COUNT(*) as count
FROM migrations m
JOIN phone_numbers pn ON pn.migration_id = m.id
GROUP BY m.id, m.name, pn.porting_status
ORDER BY m.name, pn.porting_status;

-- Unassigned numbers view
CREATE VIEW unassigned_numbers AS
SELECT
    pn.*,
    m.name as migration_name,
    s.name as site_name
FROM phone_numbers pn
JOIN migrations m ON pn.migration_id = m.id
JOIN sites s ON pn.site_id = s.id
WHERE pn.assigned_user_id IS NULL
  AND pn.assigned_resource_account_id IS NULL
  AND pn.number_type = 'user';

-- ============================================================================
-- SEED DATA (optional - common values)
-- ============================================================================

-- You can uncomment and run these to add initial data

-- INSERT INTO team_members (email, display_name, role) VALUES
-- ('admin@contoso.com', 'System Admin', 'admin');
