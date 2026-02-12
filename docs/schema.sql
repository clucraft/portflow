-- PortFlow Database Schema v2
-- PostgreSQL 15+
-- Enterprise Voice Migration Management
-- Updated for actual workflow: Estimate → Verizon Setup → Porting → User Config

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

-- Workflow stages aligned with actual process
CREATE TYPE workflow_stage AS ENUM (
    'estimate',              -- Cost estimate phase
    'estimate_accepted',     -- Customer accepted estimate
    'verizon_submitted',     -- Submitted to Verizon
    'verizon_in_progress',   -- Verizon working on setup (1-2 weeks)
    'verizon_complete',      -- Verizon site setup complete
    'porting_submitted',     -- LOA submitted for number porting
    'porting_scheduled',     -- FOC received, port date set
    'porting_complete',      -- Numbers ported
    'user_config',           -- Assigning numbers to users in Teams
    'completed',             -- Migration complete
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
-- MIGRATIONS (EV migration projects - main entity for workflow)
-- ============================================================================

CREATE TABLE migrations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    -- Basic info
    name VARCHAR(255) NOT NULL,
    workflow_stage workflow_stage NOT NULL DEFAULT 'estimate',

    -- Carrier and routing
    target_carrier target_carrier NOT NULL DEFAULT 'verizon',
    routing_type routing_type NOT NULL DEFAULT 'direct_routing',

    -- ========== PHASE 1: SITE INFO & COST ESTIMATE ==========
    site_name VARCHAR(255) NOT NULL,
    site_address TEXT,
    site_city VARCHAR(100),
    site_state VARCHAR(100),
    site_country VARCHAR(100) NOT NULL DEFAULT 'United States',
    site_timezone VARCHAR(100) NOT NULL DEFAULT 'America/New_York',

    -- Current PBX/carrier info
    current_pbx_type VARCHAR(100),
    current_carrier VARCHAR(100),

    -- Estimate inputs
    telephone_users INTEGER NOT NULL DEFAULT 0,        -- number of users needing phones
    physical_phones_needed INTEGER NOT NULL DEFAULT 0, -- equipment count
    monthly_calling_minutes INTEGER,                   -- from existing carrier invoice
    is_porting_numbers BOOLEAN NOT NULL DEFAULT true,  -- are we porting or getting new numbers?
    new_numbers_requested INTEGER DEFAULT 0,           -- if not porting, how many new numbers

    -- Estimate amounts (manually entered)
    estimate_user_service_charge DECIMAL(10,2),  -- monthly per-user charge
    estimate_equipment_charge DECIMAL(10,2),     -- one-time equipment cost
    estimate_usage_charge DECIMAL(10,2),         -- estimated monthly usage
    estimate_total_monthly DECIMAL(10,2),        -- calculated total monthly
    estimate_total_onetime DECIMAL(10,2),        -- calculated total one-time

    estimate_created_at TIMESTAMPTZ,
    estimate_accepted_at TIMESTAMPTZ,
    estimate_notes TEXT,

    -- ========== PHASE 2: VERIZON SITE SETUP ==========
    -- Billing contact (for Verizon)
    billing_contact_name VARCHAR(255),
    billing_contact_email VARCHAR(255),
    billing_contact_phone VARCHAR(50),

    -- Local site contact
    local_contact_name VARCHAR(255),
    local_contact_email VARCHAR(255),
    local_contact_phone VARCHAR(50),

    -- Verizon request tracking
    verizon_request_submitted_at TIMESTAMPTZ,
    verizon_request_email_sent_to VARCHAR(255),
    verizon_site_id VARCHAR(100),              -- ID assigned by Verizon
    verizon_setup_complete_at TIMESTAMPTZ,
    verizon_notes TEXT,

    -- ========== PHASE 3: NUMBER PORTING ==========
    -- Carrier invoice for porting (file reference or notes)
    carrier_invoice_received BOOLEAN DEFAULT false,
    carrier_invoice_notes TEXT,
    carrier_account_number VARCHAR(100),
    carrier_pin VARCHAR(50),

    -- LOA tracking
    loa_submitted_at TIMESTAMPTZ,
    loa_submitted_to VARCHAR(255),            -- email sent to
    foc_date DATE,                            -- Firm Order Commitment
    scheduled_port_date DATE,
    actual_port_date DATE,
    porting_notes TEXT,

    -- ========== PHASE 4: USER CONFIGURATION ==========
    user_data_collection_complete BOOLEAN DEFAULT false,
    teams_config_complete BOOLEAN DEFAULT false,
    teams_config_date TIMESTAMPTZ,

    -- Magic link for customer data entry
    magic_link_token VARCHAR(100) UNIQUE,
    magic_link_created_at TIMESTAMPTZ,
    magic_link_expires_at TIMESTAMPTZ,
    magic_link_accessed_at TIMESTAMPTZ,

    -- ========== COMPLETION ==========
    completed_at TIMESTAMPTZ,

    -- Summary counts (denormalized for dashboard)
    total_numbers INTEGER DEFAULT 0,
    ported_numbers INTEGER DEFAULT 0,
    total_users INTEGER DEFAULT 0,
    configured_users INTEGER DEFAULT 0,

    notes TEXT,

    created_by UUID REFERENCES team_members(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_migrations_stage ON migrations(workflow_stage);
CREATE INDEX idx_migrations_carrier ON migrations(target_carrier);
CREATE INDEX idx_migrations_foc ON migrations(foc_date);
CREATE INDEX idx_migrations_port_date ON migrations(scheduled_port_date);
CREATE INDEX idx_migrations_magic_link ON migrations(magic_link_token);

-- ============================================================================
-- END USERS (employees receiving phone numbers)
-- ============================================================================

CREATE TABLE end_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    -- Identity (entered by customer via magic link or imported)
    display_name VARCHAR(255) NOT NULL,
    upn VARCHAR(255) NOT NULL,                -- user principal name (email)
    phone_number VARCHAR(50),                  -- E.164 format, entered by customer

    -- Optional details
    department VARCHAR(255),
    job_title VARCHAR(255),

    -- Status tracking
    is_configured BOOLEAN DEFAULT false,      -- number assigned in Teams
    configuration_date TIMESTAMPTZ,

    -- Source tracking
    entered_via_magic_link BOOLEAN DEFAULT false,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(migration_id, upn)
);

CREATE INDEX idx_end_users_migration ON end_users(migration_id);
CREATE INDEX idx_end_users_upn ON end_users(upn);
CREATE INDEX idx_end_users_configured ON end_users(is_configured);

-- ============================================================================
-- PHONE NUMBERS (DIDs being ported or acquired)
-- ============================================================================

CREATE TABLE phone_numbers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    -- Number in E.164 format (e.g., "+12125551234")
    number VARCHAR(50) NOT NULL,
    number_type phone_number_type NOT NULL DEFAULT 'user',

    -- Original carrier info (for porting)
    original_carrier VARCHAR(100),

    -- Porting status
    porting_status porting_status NOT NULL DEFAULT 'not_started',
    ported_date DATE,
    verified_date DATE,

    -- Assignment
    assigned_user_id UUID REFERENCES end_users(id) ON DELETE SET NULL,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(number)
);

CREATE INDEX idx_phone_numbers_migration ON phone_numbers(migration_id);
CREATE INDEX idx_phone_numbers_status ON phone_numbers(porting_status);
CREATE INDEX idx_phone_numbers_user ON phone_numbers(assigned_user_id);

-- ============================================================================
-- RESOURCE ACCOUNTS (for Auto Attendants and Call Queues)
-- ============================================================================

CREATE TABLE resource_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    upn VARCHAR(255) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    account_type resource_account_type NOT NULL,
    phone_number VARCHAR(50),

    is_created_in_azure BOOLEAN DEFAULT false,
    is_licensed BOOLEAN DEFAULT false,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE(migration_id, upn)
);

CREATE INDEX idx_resource_accounts_migration ON resource_accounts(migration_id);

-- ============================================================================
-- AUTO ATTENDANTS (simplified)
-- ============================================================================

CREATE TABLE auto_attendants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    resource_account_id UUID REFERENCES resource_accounts(id) ON DELETE SET NULL,
    phone_number VARCHAR(50),

    language_id VARCHAR(20) NOT NULL DEFAULT 'en-US',
    timezone VARCHAR(100) NOT NULL,

    greeting_text TEXT,
    menu_options JSONB,
    business_hours JSONB,

    is_deployed BOOLEAN DEFAULT false,
    teams_aa_id VARCHAR(100),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auto_attendants_migration ON auto_attendants(migration_id);

-- ============================================================================
-- CALL QUEUES (simplified)
-- ============================================================================

CREATE TABLE call_queues (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    name VARCHAR(255) NOT NULL,
    resource_account_id UUID REFERENCES resource_accounts(id) ON DELETE SET NULL,
    phone_number VARCHAR(50),

    language_id VARCHAR(20) NOT NULL DEFAULT 'en-US',
    routing_method VARCHAR(50) DEFAULT 'attendant',

    greeting_text TEXT,
    agent_ids JSONB,  -- array of end_user IDs

    is_deployed BOOLEAN DEFAULT false,
    teams_cq_id VARCHAR(100),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_call_queues_migration ON call_queues(migration_id);

-- ============================================================================
-- GENERATED SCRIPTS
-- ============================================================================

CREATE TABLE generated_scripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    migration_id UUID NOT NULL REFERENCES migrations(id) ON DELETE CASCADE,

    script_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    script_content TEXT NOT NULL,

    generated_by UUID REFERENCES team_members(id),
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_generated_scripts_migration ON generated_scripts(migration_id);

-- ============================================================================
-- ACTIVITY LOG
-- ============================================================================

CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

    migration_id UUID REFERENCES migrations(id) ON DELETE CASCADE,
    team_member_id UUID REFERENCES team_members(id) ON DELETE SET NULL,

    action VARCHAR(100) NOT NULL,
    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_activity_log_migration ON activity_log(migration_id);
CREATE INDEX idx_activity_log_created ON activity_log(created_at);

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_migrations_updated_at BEFORE UPDATE ON migrations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_end_users_updated_at BEFORE UPDATE ON end_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_phone_numbers_updated_at BEFORE UPDATE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resource_accounts_updated_at BEFORE UPDATE ON resource_accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_auto_attendants_updated_at BEFORE UPDATE ON auto_attendants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_call_queues_updated_at BEFORE UPDATE ON call_queues FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update migration summary counts
CREATE OR REPLACE FUNCTION update_migration_counts()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE migrations SET
        total_numbers = (SELECT COUNT(*) FROM phone_numbers WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id)),
        ported_numbers = (SELECT COUNT(*) FROM phone_numbers WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id) AND porting_status IN ('ported', 'verified')),
        total_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id)),
        configured_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = COALESCE(NEW.migration_id, OLD.migration_id) AND is_configured = true)
    WHERE id = COALESCE(NEW.migration_id, OLD.migration_id);
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_counts_phone_numbers AFTER INSERT OR UPDATE OR DELETE ON phone_numbers FOR EACH ROW EXECUTE FUNCTION update_migration_counts();
CREATE TRIGGER update_counts_end_users AFTER INSERT OR UPDATE OR DELETE ON end_users FOR EACH ROW EXECUTE FUNCTION update_migration_counts();

-- ============================================================================
-- VIEWS
-- ============================================================================

-- Dashboard view with workflow progress
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

    m.created_at,
    m.updated_at
FROM migrations m
LEFT JOIN team_members tm ON tm.id = m.created_by
WHERE m.workflow_stage NOT IN ('cancelled');
