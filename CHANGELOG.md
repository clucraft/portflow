# Changelog

All notable changes to PortFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.14.0] - 2026-05-11

### Added
- **Priority and Complexity columns** on the Locations table, color-coded (High = red, Medium = amber, Low = zinc)
- **Sortable columns** on the Locations table — click any header to sort ascending, click again for descending. Custom orderings for non-alphabetic fields: Status (Planned → In Progress → Completed → On Hold → Cancelled → Out of Scope), Priority/Complexity (High → Medium → Low → empty)
- **Send Kick-off Email** — bulk action on the Locations page. Select 1+ locations → "Send Kick-off Email" appears in the action bar → preview modal shows recipients with valid/invalid email counts, paginated email preview, inline subject/body edit, "Copy Current" to clipboard fallback, and "Send" via the existing SMTP relay. Each location's local_it_contact gets a personalized email with placeholders replaced (site code, location, dates, assigned engineer, etc.)
- **Kick-off Email Template** in Settings → Integrations — editable subject and body with placeholders: `{site_code}`, `{location_name}`, `{country}`, `{region}`, `{company}`, `{priority}`, `{complexity}`, `{assigned_engineer}`, `{local_it_contact}`, `{kickoff_with_it_date}`, `{planned_start_date}`, `{planned_end_date}`, `{estimated_users}`, `{sender_display_name}`
- **Configurable From address and display name** for kick-off emails (e.g. `teams-ev@yourcompany.com` / "Teams EV Team"). Defaults to the SMTP relay's From address if left blank
- New audit log action `location.kickoff_email_sent` (one per recipient)

## [0.13.1] - 2026-05-04

### Fixed
- Completion celebration's **Share** button now works on plain HTTP deployments. The modern `navigator.clipboard` API only works on HTTPS or localhost; falls back to a hidden textarea + `document.execCommand('copy')` so the share message copies in any environment

## [0.13.0] - 2026-05-04

### Added
- **Completion celebration** — clicking "Mark Migration Complete" now triggers a cinematic sequence: page dim, animated checkmark with green pulse ring, multiple confetti bursts in PortFlow brand colors (cyan/green/white), and a celebration card showing project name, site, and stats (users migrated, total days from estimate to completion, carrier) plus the project's start → end date range. **Share button** copies a celebratory message to the clipboard for pasting into Teams/email. Esc or backdrop click dismisses. Respects `prefers-reduced-motion` (skips the bursts and animations for users with motion-sensitivity OS preferences). Only triggers on the final completion click, not when reverting/restoring stages
- New `canvas-confetti` dependency (~3KB)

## [0.12.2] - 2026-05-04

### Fixed
- `migration_dashboard` view now includes `cost_calculator` so the v0.12.1 user-count fallback actually works on the dashboard (the dashboard fetches via the view, which previously didn't expose this column). **DB migration required**: `docs/migration_dashboard_view_cost_calculator.sql`

### Database Migration Required
```sql
-- Recreates migration_dashboard view to include cost_calculator
-- See docs/migration_dashboard_view_cost_calculator.sql
```

## [0.12.1] - 2026-05-04

### Fixed
- User counts in dashboard cards, Project Status Report, Reports totals, and CSV exports now fall back to the Cost Calculator's "Total Users" when the end_users list is empty. New `effectiveUserCount()` helper returns: `total_users` (auto-counted from end_users) → `cost_calculator.total_users` (from estimate) → `telephone_users` (legacy field). The "X of Y configured" indicator on Phase 4 still uses the raw end_users count since it specifically reflects the user list

## [0.12.0] - 2026-05-04

### Added
- **Locations master list** — new sidebar page tracking the global Teams EV rollout. Each entry has a unique site code, location name, region, country, company, planned/historical dates, complexity, priority, contacts, notes, and a status (Planned / In Progress / Completed / On Hold / Cancelled / Out of Scope). Optionally links to a PortFlow migration project (1:1) — when linked, status auto-derives from the project's workflow stage so the two can't drift
- **Excel import for locations** — bulk-import the master list from .xlsx with auto-match against existing PortFlow projects (matches site code to project name). Preview dialog shows what will be created and which entries will auto-link, with per-row checkboxes to opt out of linking. Robust header normalization handles multi-line headers and various date formats
- **Bulk delete on Locations list** — checkbox column with select-all in the header; action bar appears when 1+ rows are selected with a confirmation dialog listing the codes about to be deleted. Linked migration projects are not affected
- **Create Project from a Location** — unlinked locations have a "Create Project" button that pre-fills New Migration with site code, city, country, and region, then automatically links the new project back to the location on save
- **Linked location pill** in the migration detail header — green badge with the site code that opens the location page
- **Locations Coverage** card on the Reports page — overall progress (Completed / In Progress / Planned / On Hold) with stacked progress bar, plus a per-region breakdown
- **Project Status Report** on the Reports page — executive snapshot with three side-by-side sections: Completed (with completion date, users, carrier), In Progress (with phase, key date, assignee), and On Hold (with reason highlighted in amber, prior stage, and date paused). Three actions: **Print Report** (PDF-friendly print stylesheet that hides the sidebar/nav), **Copy for Email** (rich HTML with inline styles — pastes cleanly into Outlook/Gmail), and **Copy as Text** (markdown-style fallback for any email client)
- New `locations` table (migration: `docs/migration_add_locations.sql`); included in the database backup

### Fixed
- Location detail page now correctly displays imported dates — PostgreSQL returns DATE columns as ISO timestamps with time, but `<input type="date">` requires bare `YYYY-MM-DD`. Truncates dates when populating the form

### Database Migration Required
```sql
-- Run docs/migration_add_locations.sql
-- Adds the locations table with indexes and trigger
```

## [0.11.0] - 2026-04-29

### Added
- **Send to SharePoint list** — new Phase 5 task "Added to Migrated Locations List" with a "Send" action that pushes migration data to a configured Power Automate webhook (creates the SharePoint list item server-side). Falls back to "Copy Details" (tab-separated values for paste) when no webhook is configured. Auto-checks the task on a successful send. Backed by a new SharePoint webhook URL field in Settings > Integrations
- Settings: renamed **Email** tab to **Integrations**; SMTP settings and the new SharePoint webhook URL both live there
- **Project History modal** — new "History" button in the project header opens a modal showing the audit log filtered to that project. Available to any authenticated user (not admin-only). Shows action label, details, actor name, and relative timestamp. Backed by a new `GET /api/migrations/:id/history` endpoint
- **More actions are now logged to the audit trail** so they appear in the History view: estimate updates (with totals + method), estimate link generated, estimate accepted (admin override and customer link), general project updates (lists changed fields), carrier request submitted/complete, LOA submitted, FOC date set, porting complete, magic/questionnaire links generated, customer-submitted questionnaire and user collection, and script generation (Teams, AD, Dial Plan)
- **Phase 5: Documentation** — new parallel phase (runs alongside Phase 4) for administrative closeout tasks. Default checklist: Phone List Created (SharePoint), Loop Documentation Created. Verizon migrations also get "Location Account Added to Management Accounts" (conditional on carrier)
- **Loop Documentation generator** — "Generate" button next to the Loop Documentation task opens a preview modal showing the pre-filled content with numbered section headings rendered as H2. "Copy to Clipboard" copies via a rendered DOM element (browser's native rich-text copy path), so pasting into Loop, Word, OneNote, etc. preserves the H2 heading formatting. Uses migration data: site city, location code, local contact email, carrier, voice routing policy, dial plan, emergency number
- **Phase 4 task**: "Test numbers validated working" (normally validated ~1 week after carrier location creation)
- **Assignment email notifications** — "Notify assignee by email" checkbox appears next to the Assignee dropdown on New Migration and project detail edit forms when selecting someone other than yourself. Opts in per-assignment (always resets to unchecked). Sends a notification email via the configured email relay with project name, site, current stage, who assigned them, and a direct link. Silently skipped if the assignee is unchanged, if it's the current user, or if email relay isn't configured

### Changed
- Project detail header now uses colored pill badges (matching the dashboard cards) for carrier (red), routing type (cyan), country code (blue), and assignee (cyan with user icon). Site location moved out into a plain subline; created/updated metadata stays subdued
- "Mark Migration Complete" button moved from Phase 4 to Phase 5 (Documentation is the natural closeout phase). Gating unchanged — still requires number porting to be complete
- Phase 4 task "Physical Phone Deployment" renamed to "Device configuration (phones, fax, ATA, etc.)"
- Phase 4 task order: Dial Plan Creation → Test numbers validated working → Holiday Sets → Auto Attendants & Call Queues → Device configuration. Existing migrations now also display in this canonical order (previously kept the order they were first saved in)
- Dial plan script description format: `Dial plan for <migration name>` → `DP <city>, GIS <country>` using the migration's site location fields
- Dial plan pre-flight confirmation now shows City, Country, and the resulting Description string; blocks generation if City or Country is missing (server also validates)

### Fixed
- Putting a migration on hold no longer auto-completes Phase 1 and 2 or marks Phase 3/4/5 as active. Phase statuses and the workflow progress bar now use the migration's `on_hold_previous_stage` so they reflect where the project was actually paused
- Survey import now correctly maps the DECT count column — the Excel header "How many cordless phones (DECT) are there?" is now recognized and imported into `dect_count` (used by the cost calculator's DECT Phones field)
- Emergency numbers in generated dial plan scripts no longer prefix with `+` — 911, 112, etc. now translate to the plain dialed digits (previously produced "+911", "+112" which are invalid for short emergency codes)

## [0.10.0] - 2026-04-16

### Added
- **Detailed cost breakdown** on customer acceptance page — line items now show sub-item details (e.g. "20 units x $150.00") for desk phones, smartphones, headsets, carrier activation fee, and user service rate when calculator data is available; falls back to totals-only for legacy estimates
- **Alternative estimates** on customer acceptance page — collapsible "View alternative estimates" section shows the two non-selected methods with device quantities and cost breakdowns
- **Cost comparison charts** on customer acceptance page — grouped bar chart (annual cost breakdown) and cumulative SVG line chart (3-year spend with savings area) when current system costs are available
- **Method descriptions** on cost calculator and customer estimate page — short explanations of what each estimation method calculates (Report: site survey based, Custom: manual quantities, 20%/50%: conservative estimate)
- **Download Excel** button on customer estimate acceptance page — generates a multi-sheet XLSX workbook with Cost Estimate (project details, line-item breakdown with unit counts), Method Comparison (all 3 methods side by side), and 3-Year Comparison (current system vs Teams with savings)
- **Comprehensive Export All** on Reports page — replaces the basic export with a full-detail CSV including site info, estimate line items, calculator details (method, device counts, unit costs, current system costs), all phase milestone dates, assignee, and notes
- **Dashboard filters persist in URL** — search, sort, and filter selections (creator, assignee, carrier, country) are stored as URL query parameters. Filters survive back/forward navigation, page refresh, and can be bookmarked or shared as links
- **Colored pill badges on dashboard cards** — assignee (cyan), carrier (red), user count (purple), and port/FOC dates (amber/green) now show as colored pill badges for at-a-glance scanning
- **Expanded survey import** — maps new Excel columns: Street Address, City, State, Country, LA Code, and "Total Enterprise Voice User Count"; fuzzy header matching for long Excel column names; location details auto-populate migration fields on import
- **On Hold status** for migration projects — "Hold" button on any active migration opens a dialog for an optional reason; "Resume" button returns to the previous workflow stage; on-hold banner shows reason and date on the migration detail page; dedicated "On Hold" section on the dashboard with count in stats; on-hold count added to Reports summary
- **Backup & Restore** in Settings (admin only) — download a full JSON backup of all database tables (team members, settings, carriers, policies, migrations with all child data, scripts, audit log) and restore from a previous backup with confirmation dialog showing table row counts
- Consolidated `docs/schema.sql` — fresh Docker deployments now include all previously-separate migration changes (password_hash, cost_calculator, currency, voice_routing_policy, dial_plan, region/location_code, phase_tasks, site_questionnaire, app_settings/carriers/voice_routing_policies/dial_plans/notification_subscriptions tables), working out of the box without manual migration commands

### Changed
- Settings > Pricing fields organized into categorized groups (Recurring Rates, Equipment Costs, Carrier Fees)
- User Service Rate in Settings now displays with 2 decimal places
- "Total End User Count" renamed to "Total Enterprise Voice Users" throughout the app
- Customer estimate page now shows user count from cost calculator (not questionnaire) when available
- Dashboard shows on-hold migrations in a dedicated section (previously hidden from the main view with no surfacing)

### Fixed
- Dial plan script generation no longer prompts for `-InMemory` parameter — `New-CsVoiceNormalizationRule` now uses `-Parent`/`-Name`/`-InMemory` with `Set-CsTenantDialPlan -NormalizationRules @{Add=$rule}` pattern, running cleanly without interactive prompts
- Backup/restore: `activity_log` table now restores correctly (JSONB string values properly serialized; dedicated client connection ensures FK disable persists across queries)
- Cumulative 3-year chart on customer estimate page no longer clips the end labels or "Year 3" x-axis text
- Reports page no longer crashes with React error #310 (useState declaration order fixed)

### Security
- Upgraded `axios` from 1.13.4 to 1.14.0 to address DoS vulnerability (GHSA-43fc-jf86-j433)

### Database Migration Required
```sql
-- Run docs/migration_add_on_hold.sql
-- Adds on_hold_previous_stage, on_hold_reason, on_hold_at columns
-- and recreates the migration_dashboard view to include them
```

## [0.9.0] - 2026-03-30

### Added
- **Cost Calculator** replacing the Phase 1 estimate form — 3-method side-by-side comparison (A: Report, B: Custom, C: 20%/50%) matching the Excel "EV Migration Site Cost Estimator" logic; user picks a method to "Apply" as the official estimate
- **3-year cost comparison** on customer estimate acceptance page — compares current PBX system costs vs Teams EV over 3 years with annual savings breakdown (only shown when current system costs are entered)
- **Smartphone unit cost** and **carrier activation fee** as new pricing fields in Settings > Pricing (defaults: 400 and 244 respectively)
- **CHF currency** option for Swiss franc support — available in New Migration, project detail edit, and estimate acceptance page
- New `cost_calculator` JSONB column on migrations storing all calculator inputs, per-method device quantities, current system costs, and selected method

### Changed
- Phase 1 estimate form replaced with full CostCalculator component (site inputs, unit costs, current system costs, method comparison table, notes)
- Settings > Pricing expanded from 3 to 5 fields; "Phone Unit Cost" renamed to "Desk Phone Unit Cost" for clarity
- Activation fee included in one-time total calculation (server-side)

### Database Migration Required
```sql
-- Run docs/migration_add_cost_calculator.sql
ALTER TABLE migrations ADD COLUMN IF NOT EXISTS cost_calculator JSONB DEFAULT NULL;
```

## [0.8.0] - 2026-02-23

### Added
- **Pre-flight confirmation dialog** for script generation — clicking a script type in the dropdown now opens a modal showing a checklist of prerequisites (carrier, VRP, dial plan, location code, users) with green check / red X status icons; Generate button is disabled when any check fails
- **Server-side validation** for Teams User Assignment script — rejects with 400 if Voice Routing Policy is missing on Direct Routing migrations, or if Dial Plan or Location Code are empty
- Mutation errors now display inline in the confirmation dialog instead of failing silently

## [0.7.0] - 2026-02-23

### Added
- **Region & Location Code fields** — new mandatory `region` (AMER/EMEA/APAC) and `location_code` fields on migrations for dial plan naming convention
- **Dial Plan Setup script generation** — generates PowerShell to create a Teams tenant dial plan (`New-CsTenantDialPlan`) with country-appropriate normalization rules (emergency, national, international); supports US/CA (+1), Germany (+49), UK (+44), and generic fallback
- **Assign migrations to team members** — new `assigned_to` field tracks who is responsible for each migration project
- Assignee dropdown in New Migration form (defaults to current user) and project detail edit form
- Dashboard shows assignee on each migration card with "All Assignees" filter dropdown
- Bulk survey import automatically assigns imported migrations to the importing user
- Migration detail page shows both creator and assignee
- **Import from Microsoft Teams** — PowerShell export script + CSV bulk import for dial plans and voice routing policies (Settings > Policies)
- **Bulk Export Questionnaires** button on Reports page — exports all migrations' questionnaire data in one CSV (one row per migration, all questionnaire fields as columns)
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
- **Editable completed phases** (admin only) — pencil icon on completed phase headers expands inline edit forms
- Inline edit form for Phase 1 (estimate charges and notes), Phase 2 (email sent to, site ID), Phase 3 (FOC date, scheduled/actual port dates)
- **Revert Phase** button (admin only) — moves workflow stage backward with confirmation dialog
- **Export CSV** button on Site Questionnaire — downloads questionnaire responses as a CSV file with section headers, field/value pairs, and proper escaping

### Changed
- **Questionnaire CSV export** now produces standard flat CSV format (one header row with all field labels as columns, one data row with values) instead of section-header/field-value layout
- Dashboard migration cards no longer show creator name (assignee shown instead)

### Database Migration Required
```sql
-- Run docs/migration_add_region_location.sql
-- Adds region and location_code columns to migrations

-- Run docs/migration_add_assigned_to.sql
-- Adds assigned_to column and recreates migration_dashboard view with assignee join

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

[Unreleased]: https://github.com/clucraft/portflow/compare/v0.14.0...HEAD
[0.14.0]: https://github.com/clucraft/portflow/compare/v0.13.1...v0.14.0
[0.13.1]: https://github.com/clucraft/portflow/compare/v0.13.0...v0.13.1
[0.13.0]: https://github.com/clucraft/portflow/compare/v0.12.2...v0.13.0
[0.12.2]: https://github.com/clucraft/portflow/compare/v0.12.1...v0.12.2
[0.12.1]: https://github.com/clucraft/portflow/compare/v0.12.0...v0.12.1
[0.12.0]: https://github.com/clucraft/portflow/compare/v0.11.0...v0.12.0
[0.11.0]: https://github.com/clucraft/portflow/compare/v0.10.0...v0.11.0
[0.10.0]: https://github.com/clucraft/portflow/compare/v0.9.0...v0.10.0
[0.9.0]: https://github.com/clucraft/portflow/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/clucraft/portflow/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/clucraft/portflow/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/clucraft/portflow/compare/v0.5.0...v0.6.0
[0.5.0]: https://github.com/clucraft/portflow/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/clucraft/portflow/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/clucraft/portflow/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/clucraft/portflow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/clucraft/portflow/releases/tag/v0.1.0
