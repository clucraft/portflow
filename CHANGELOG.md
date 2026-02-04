# Changelog

All notable changes to PortFlow will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/clucraft/portflow/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/clucraft/portflow/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/clucraft/portflow/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/clucraft/portflow/releases/tag/v0.1.0
