# Changelog

All notable changes to PortFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Authentication system** with email + password login (bcrypt + JWT)
- First-run setup page to create initial admin account
- Role-based access control: admin (full), member (read+write), viewer (read-only)
- Protected routes — all app pages require authentication
- Login page with ParticleBackground matching app aesthetic
- User management in Settings (add, edit, deactivate, reset password)
- Change password for self
- **Settings page** with tabbed navigation (Users, Carriers, Policies, Email, Audit Log)
- **Dynamic carriers** — carriers stored in database with admin CRUD (replaces hardcoded ENUM)
- **Voice routing policies** and **dial plans** as pre-defined database entries with admin CRUD
- ComboBox component for selecting pre-defined options or entering custom values
- **Email relay notifications** — configurable SMTP settings with test button
- Migration notification subscriptions — bell icon to subscribe/unsubscribe per migration
- Email notifications sent to subscribers on workflow stage transitions
- **Audit log** — tracks all create/update/delete actions across the system
- Audit log viewer in Settings with filters (action, date range) and pagination
- Viewer role strictly read-only: all write UI elements hidden, server rejects mutations with 403
- Tenant Dial Plan field for migrations (`Grant-CsTenantDialPlan`), applies to both Direct Routing and Operator Connect
- Save Draft for customer data collection: customers can save progress and return later via the same magic link
- Draft/complete status indicators on Migration Detail Phase 4 panel
- Append mode: customers can add more users after initial submission
- Admin-added users shown in separate read-only section on customer collect page
- Phase 4 subtask checklist (Auto Attendants & Call Queues, Holiday Sets, Physical Phone Deployment)
- Task progress shown on Phase 4 header ("2/3 tasks" alongside user count)
- JSONB `phase_tasks` column for flexible per-phase task definitions
- Voice Routing Policy field for Direct Routing migrations (hidden for Operator Connect)
- Voice routing policy included in Teams user assignment script (`Grant-CsOnlineVoiceRoutingPolicy`)
- Searchable country code dropdown with full worldwide list (~200 countries)

### Database Migration Required
```sql
-- Round 1: Run docs/migration_settings_round1.sql
-- Adds password_hash to team_members, creates app_settings table

-- Round 2: Run docs/migration_settings_round2.sql
-- Creates carriers, voice_routing_policies, dial_plans tables
-- Converts migrations.target_carrier from ENUM to TEXT
-- Recreates migration_dashboard view

-- Round 3: Run docs/migration_settings_round3.sql
-- Creates notification_subscriptions table

-- Also run docs/migration_add_phase_tasks.sql
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS phase_tasks JSONB DEFAULT '{}';
-- Also recreates the migration_dashboard view to include phase_tasks
```

### Environment Variables
```
JWT_SECRET=<your-secret-key>
JWT_EXPIRES_IN=24h  # optional, defaults to 24h
```

### New Dependencies
- `bcryptjs`, `jsonwebtoken` (Round 1)
- `nodemailer` (Round 3)

## [0.6.0] - 2025-02-05

### Added
- Reports page with live summary data and CSV export capabilities
- Export All, Active, and Completed migrations to CSV
- Active Directory phone number script generation
- Script generation dropdown menu (Teams User Assignment vs AD Phone Numbers)
- Script type badges with distinct colors and icons in Scripts page
- Delete button for migrations (with confirmation prompt)
- Delete and download buttons for scripts
- E.164 phone number validation with country code enforcement
- Country code selector in New Migration form (Step 3)
- Phone validation on admin Users page, customer collect page, and server-side

### Changed
- "Generate Script" button replaced with dropdown for script type selection
- Scripts page now shows clear script type labels (Teams User Assignment, AD Phone Numbers)
- Dashboard status now shows dynamic carrier name instead of hardcoded "Verizon"
- Completed migrations show completion date in dashboard list

### Fixed
- Copy to clipboard on Scripts page now works with fallback method
- Scripts page using light theme classes instead of dark theme

### Database Migration Required
```sql
ALTER TABLE migrations
ADD COLUMN IF NOT EXISTS country_code VARCHAR(10) NOT NULL DEFAULT '+1';
```

## [0.5.0] - 2025-02-04

### Added
- Search bar on Dashboard to filter by site name or project name
- Search bar on Scripts page to filter by script name or type
- Parallel workflow: Phase 3 (Porting) and Phase 4 (Teams Config) now run simultaneously
- Phase 2 completion summary shows submitted date, email, completed date, and site ID
- Customer name from estimate acceptance now displays in Phase 1 summary

### Changed
- Phase 2 label dynamically shows selected carrier (Verizon/FusionConnect/GTT Setup)
- All carrier-specific field labels and buttons now use dynamic carrier name
- README redesigned with terminal-style ASCII art matching app aesthetic
- "Mark Migration Complete" button disabled until porting completes

### Fixed
- Estimate acceptance page showing blank (PostgreSQL returns numbers as strings)
- Phase progression not advancing after completing Phase 1 or Phase 2
- Phase 3 and 4 status now correctly reflects parallel workflow
- Scripts page was using light theme classes instead of dark theme

## [0.4.0] - 2025-02-04

### Added
- Terminal-style progress bar with `[✓] [►] [ ]` indicators
- Timeline list layout for migration phases with vertical connector lines
- CSV upload for customer data collection with downloadable template
- CSV supports flexible column names (display_name/name, upn/email, etc.)

### Changed
- Complete redesign of Migration Detail page from tile-based to timeline layout
- Active phase expands to show form/actions, completed phases collapse to summary
- CustomerCollect page now uses dark theme matching rest of application
- Script naming now uses "Site Name - Project Name" format
- Removed "New Migration" from sidebar (use dashboard button instead)

### Fixed
- CustomerCollect page had white background instead of dark theme

### Database Migration Required
```sql
-- Create trigger function for user counts
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

-- Create triggers
DROP TRIGGER IF EXISTS update_counts_end_users ON end_users;
CREATE TRIGGER update_counts_end_users AFTER INSERT OR UPDATE OR DELETE ON end_users FOR EACH ROW EXECUTE FUNCTION update_migration_counts();

-- Fix existing counts
UPDATE migrations m SET
    total_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = m.id),
    configured_users = (SELECT COUNT(*) FROM end_users WHERE migration_id = m.id AND is_configured = true);
```

## [0.3.0] - 2025-02-04

### Added
- Customer estimate acceptance page with read-only cost view
- Shareable estimate links with configurable expiration (default 14 days)
- Override accept button for admin to bypass customer approval
- Gantt-style progress chart on migration detail page showing 4 phases
- Public API endpoints for estimate view and acceptance (`/api/public/estimate/:token`)
- Notes field for cost estimates

### Changed
- Moved customer data collection link from Migration Detail to Users page
- Phase 1 now shows "Send to Customer" button to generate estimate link
- Progress visualization now uses horizontal bar chart grouped by phase

### Database Migration Required
```sql
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_link_token TEXT;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_link_created_at TIMESTAMPTZ;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_link_expires_at TIMESTAMPTZ;
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS estimate_accepted_by TEXT;
```

## [0.2.0] - 2025-02-04

### Added
- Retro dark theme with JetBrains Mono font
- Animated particle background effect (inspired by PriceGhost)
- Cyan accent color scheme with glow effects
- Custom scrollbar styling
- Stage-colored badges and progress indicators

### Changed
- Complete UI overhaul from light to dark theme
- Updated all components to use new color palette
- Sidebar now has glassmorphism effect with backdrop blur

## [0.1.0] - 2025-02-04

### Added
- Initial release of PortFlow
- 4-phase workflow for Teams Enterprise Voice migrations:
  - Phase 1: Cost Estimate (create, save, accept)
  - Phase 2: Verizon Setup (submit request, track progress, mark complete)
  - Phase 3: Number Porting (LOA submission, FOC tracking, port scheduling)
  - Phase 4: User Configuration (user management, Teams assignment)
- Dashboard with active migrations and progress overview
- Migration detail page with phase-specific actions
- User management with manual entry and customer data collection
- Magic link for customer self-service user data entry
- PowerShell script generation for Teams user assignments
- Support for Direct Routing and Operator Connect
- Support for Verizon, FusionConnect, and GTT carriers
- Docker deployment with PostgreSQL database
- GitHub Actions CI/CD for container builds

### Technical
- React 18 + TypeScript + Vite frontend
- Node.js + Express + TypeScript backend
- PostgreSQL 16 with UUID primary keys
- TanStack Query for data fetching
- Tailwind CSS for styling

[Unreleased]: https://github.com/clucraft/portflow/compare/v0.6.0...HEAD
[0.6.0]: https://github.com/clucraft/portflow/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/clucraft/portflow/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/clucraft/portflow/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/clucraft/portflow/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/clucraft/portflow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/clucraft/portflow/releases/tag/v0.1.0
