# PortFlow Database Schema

## Overview

PostgreSQL database schema for managing enterprise voice migrations from legacy PBX to Microsoft Teams.

## Entity Relationship Summary

```
team_members ─────┬──────────────────────────────────────────────────────┐
                  │                                                      │
                  ▼                                                      │
              sites ◄─────────────────────┐                              │
                  │                       │                              │
                  ▼                       │                              │
            migrations ◄──────────────────┼───── migration_assignments ──┘
                  │                       │
    ┌─────────────┼─────────────┐         │
    │             │             │         │
    ▼             ▼             ▼         │
end_users   resource_accounts  phone_numbers
    │             │             │
    │             │             │
    │     ┌───────┴───────┐     │
    │     │               │     │
    │     ▼               ▼     │
    │  auto_attendants  call_queues
    │                     │
    └─────────────────────┘
              │
              ▼
      call_queue_agents
```

## Tables

### Core Entities

| Table | Purpose |
|-------|---------|
| `team_members` | PortFlow app users (your migration team) |
| `sites` | Physical locations being migrated |
| `migrations` | A migration project for a site |
| `end_users` | Employees receiving phone numbers |
| `phone_numbers` | DIDs being ported |
| `resource_accounts` | Service accounts for AA/CQ |
| `auto_attendants` | Auto attendant configurations |
| `call_queues` | Call queue configurations |
| `call_queue_agents` | Users assigned as CQ agents |

### Supporting Tables

| Table | Purpose |
|-------|---------|
| `migration_assignments` | Team members assigned to migrations |
| `activity_log` | Audit trail of all changes |
| `import_batches` | Track CSV/Excel import history |
| `generated_scripts` | Store generated PowerShell scripts |

## Key Fields

### Phone Number Porting Status Flow

```
not_started → loa_submitted → foc_received → port_scheduled → ported → verified
                    ↓
              loa_rejected (can retry)
                    ↓
                 failed
```

### Migration Status Flow

```
planning → discovery → data_collection → in_progress → porting → testing → completed
                                              ↓
                                          on_hold / cancelled
```

## JSONB Fields

Several fields use JSONB for flexible data storage:

### `sites.business_hours`
```json
{
  "monday": { "open": "08:00", "close": "17:00" },
  "tuesday": { "open": "08:00", "close": "17:00" },
  "friday": { "open": "08:00", "close": "15:00" },
  "saturday": null,
  "sunday": null
}
```

### `sites.holidays`
```json
[
  { "name": "New Year's Day", "date": "2024-01-01" },
  { "name": "Christmas", "date": "2024-12-25" }
]
```

### `auto_attendants.business_hours_menu_options`
```json
[
  {
    "key": "1",
    "action": "transfer_call_queue",
    "target": "cq-sales-id",
    "prompt": "For Sales, press 1"
  },
  {
    "key": "2",
    "action": "transfer_user",
    "target": "support@contoso.com",
    "prompt": "For Support, press 2"
  },
  {
    "key": "0",
    "action": "transfer_operator",
    "prompt": "To speak with an operator, press 0"
  }
]
```

### `activity_log.changes`
```json
{
  "field": "porting_status",
  "old_value": "loa_submitted",
  "new_value": "foc_received"
}
```

## Enum Types

| Type | Values |
|------|--------|
| `migration_status` | planning, discovery, data_collection, in_progress, porting, testing, completed, on_hold, cancelled |
| `target_carrier` | verizon, fusionconnect, gtt |
| `routing_type` | direct_routing, operator_connect |
| `phone_number_type` | user, auto_attendant, call_queue, fax, conference_room, shared, other |
| `porting_status` | not_started, loa_submitted, loa_rejected, foc_received, port_scheduled, ported, verified, failed |
| `resource_account_type` | auto_attendant, call_queue |
| `cq_routing_method` | attendant, serial, round_robin, longest_idle |
| `overflow_action` | disconnect, forward_external, forward_user, voicemail, shared_voicemail |
| `team_role` | admin, member, viewer |

## Views

| View | Purpose |
|------|---------|
| `migration_dashboard` | Summary stats for all migrations with progress percentages |
| `porting_status_summary` | Count of numbers by porting status per migration |
| `unassigned_numbers` | User-type numbers not yet assigned to anyone |

## Automatic Features

- **`updated_at` triggers**: All main tables auto-update this timestamp on changes
- **Migration count triggers**: `total_numbers`, `ported_numbers`, `total_users`, `configured_users` are auto-calculated
- **UUID primary keys**: All tables use UUIDs for distributed-friendly IDs

## Indexes

Optimized for common queries:
- Migration lookups by site, status, target date
- Phone number lookups by status, type, assignment
- Activity log queries by entity, migration, date range
- User lookups by UPN, migration, configuration status
