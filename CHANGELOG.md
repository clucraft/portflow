# Changelog

All notable changes to PortFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/clucraft/portflow/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/clucraft/portflow/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/clucraft/portflow/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/clucraft/portflow/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/clucraft/portflow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/clucraft/portflow/releases/tag/v0.1.0
