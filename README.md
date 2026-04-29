<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/clucraft/portflow/main/docs/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="https://raw.githubusercontent.com/clucraft/portflow/main/docs/logo-light.svg">
  <img alt="PortFlow" src="https://raw.githubusercontent.com/clucraft/portflow/main/docs/logo-dark.svg" width="400">
</picture>

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ██████╗  ██████╗ ██████╗ ████████╗███████╗██╗      ██████╗ ██╗    ██╗       ║
║   ██╔══██╗██╔═══██╗██╔══██╗╚══██╔══╝██╔════╝██║     ██╔═══██╗██║    ██║       ║
║   ██████╔╝██║   ██║██████╔╝   ██║   █████╗  ██║     ██║   ██║██║ █╗ ██║       ║
║   ██╔═══╝ ██║   ██║██╔══██╗   ██║   ██╔══╝  ██║     ██║   ██║██║███╗██║       ║
║   ██║     ╚██████╔╝██║  ██║   ██║   ██║     ███████╗╚██████╔╝╚███╔███╔╝       ║
║   ╚═╝      ╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚═╝     ╚══════╝ ╚═════╝  ╚══╝╚══╝        ║
║                                                                               ║
║               Enterprise Voice Migration Management System                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

<div align="center">

**Streamline Microsoft Teams Enterprise Voice migrations with a modern, terminal-inspired interface**

[![GitHub release](https://img.shields.io/github/v/release/clucraft/portflow?style=flat-square&color=22d3ee)](https://github.com/clucraft/portflow/releases)
[![License](https://img.shields.io/badge/license-MIT-22d3ee?style=flat-square)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ghcr.io-22d3ee?style=flat-square)](https://github.com/clucraft/portflow/pkgs/container/portflow-client)

</div>

---

## Workflow Progress

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  WORKFLOW PROGRESS                                              75% complete │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [✓] Phase 1 → [✓] Phase 2 → [►] Phase 3 → [ ] Phase 4                      │
│                                                                             │
│  ████████████████████████████████████████████░░░░░░░░░░░░░░░░               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

  ✓ PHASE 1: COST ESTIMATE ─────────────────────────────── DONE
    Monthly: $450.00 • One-time: $1,200.00 • Accepted by: John Smith

  ✓ PHASE 2: VERIZON SETUP ─────────────────────────────── DONE
    Site ID: VZ-2024-1234

  ► PHASE 3: NUMBER PORTING ────────────────────────────── ACTIVE
    Port: 02/15/2025

    PHASE 4: TEAMS CONFIG ──────────────────────────────── PENDING
    Waiting for Phase 3 to complete
```

---

## Features

```
┌─ Migration Management ──────────────────────────────────────────────────────┐
│                                                                             │
│  • 4-phase workflow: Estimate → Carrier Setup → Porting → Teams Config      │
│  • Dynamic carrier support (add your own via Settings)                      │
│  • Direct Routing, Operator Connect, and MS Calling Plans                   │
│  • Real-time progress tracking with terminal-style indicators               │
│  • Assign migrations to team members                                        │
│  • Phase subtask checklists (Dial Plan, AA/CQ, Holidays, Phones)           │
│  • Editable completed phases with revert capability (admin)                 │
│                                                                             │
├─ Cost Calculator ──────────────────────────────────────────────────────────┤
│                                                                             │
│  • 3-method side-by-side comparison (Report / Custom / 20%-50%)            │
│  • Pre-fills from site questionnaire and global pricing settings            │
│  • Per-method device quantities: desk phones, smartphones, headsets         │
│  • 3-year cost comparison vs current PBX system                             │
│  • Multi-currency support (USD, EUR, CHF)                                   │
│                                                                             │
├─ Customer Portal ───────────────────────────────────────────────────────────┤
│                                                                             │
│  • Shareable estimate links with detailed cost breakdown                    │
│  • Collapsible alternative estimate methods for transparency                │
│  • 3-year savings charts (bar chart + cumulative line chart)                │
│  • Exchange rate conversion (ECB reference rates)                           │
│  • Magic links for customer data collection (save drafts, append)           │
│  • Site questionnaire with customer-facing submission portal                │
│                                                                             │
├─ Script Generation ─────────────────────────────────────────────────────────┤
│                                                                             │
│  • Auto-generate Teams PowerShell scripts with pre-flight validation        │
│  • Teams User Assignment (voice routing policy, dial plan, numbers)         │
│  • Active Directory phone number updates                                    │
│  • Tenant Dial Plan creation with country-specific normalization            │
│                                                                             │
├─ Administration ───────────────────────────────────────────────────────────┤
│                                                                             │
│  • Role-based access: admin, member, viewer                                 │
│  • Global pricing settings (service rate, equipment costs, fees)            │
│  • Carrier, voice routing policy, and dial plan management                  │
│  • Email relay notifications with per-migration subscriptions               │
│  • Audit log with action filtering and pagination                           │
│  • Reports dashboard with CSV exports (full detail + filtered)              │
│  • Bulk questionnaire export across all migrations                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack

```
  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
  │   FRONTEND   │    │   BACKEND    │    │   DATABASE   │
  ├──────────────┤    ├──────────────┤    ├──────────────┤
  │ React 18     │    │ Node.js      │    │ PostgreSQL   │
  │ TypeScript   │◄──►│ Express      │◄──►│ 16           │
  │ Vite         │    │ TypeScript   │    │              │
  │ Tailwind CSS │    │              │    │              │
  └──────────────┘    └──────────────┘    └──────────────┘
```

---

## Quick Start

### Fresh Deployment with Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/clucraft/portflow.git
cd portflow

# Set a secure JWT secret (required for authentication)
export JWT_SECRET=$(openssl rand -hex 32)

# Start with Docker Compose
docker-compose up -d
```

The database schema is automatically initialized on first startup. Open the frontend and you'll be prompted to create the initial admin account.

```
┌─ Access Points ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  Frontend ............................................. http://localhost:80 │
│  API ................................................ http://localhost:3001 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Restoring from a Backup

If you have a backup file from an existing PortFlow instance:

1. Deploy fresh using the steps above
2. Create the initial admin account (temporary — it will be overwritten by the restore)
3. Go to **Settings > Backup** and restore from your backup file

This brings over all data: team members, migrations, settings, carriers, users, scripts, and audit log.

### Development Setup

```bash
# Start PostgreSQL
docker run -d --name portflow-db \
  -e POSTGRES_USER=portflow \
  -e POSTGRES_PASSWORD=portflow \
  -e POSTGRES_DB=portflow \
  -p 5432:5432 \
  postgres:16-alpine

# Initialize database
cat docs/schema.sql | docker exec -i portflow-db psql -U portflow -d portflow

# Terminal 1: Start API
cd server && npm install && npm run dev

# Terminal 2: Start Client
cd client && npm install && npm run dev
```

---

## Configuration

```
┌─ Environment Variables ─────────────────────────────────────────────────────┐
│                                                                             │
│  Variable            Default                  Description                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  POSTGRES_USER       portflow                 Database username             │
│  POSTGRES_PASSWORD   portflow                 Database password             │
│  POSTGRES_DB         portflow                 Database name                 │
│  DB_PORT             5432                     PostgreSQL port               │
│  API_PORT            3001                     API server port               │
│  CLIENT_PORT         5173                     Frontend port                 │
│  CORS_ORIGIN         http://localhost:5173    Allowed CORS origin           │
│  JWT_SECRET          change-me-in-production  Auth token signing key        │
│  JWT_EXPIRES_IN      24h                      Token expiration              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
portflow/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── pages/          # Page components
│   │   └── services/       # API client
│   ├── Dockerfile
│   └── nginx.conf
├── server/                 # Express API
│   ├── src/
│   │   ├── controllers/    # Route handlers
│   │   ├── routes/         # API routes
│   │   ├── middleware/     # Express middleware
│   │   └── types/          # TypeScript types
│   └── Dockerfile
├── docs/
│   └── schema.sql          # Database schema
├── docker-compose.yml      # Production compose
└── CHANGELOG.md            # Version history
```

---

## Workflow Stages

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  PHASE 1: COST ESTIMATE                                                     │
│  ├── estimate ................... Initial cost estimate phase               │
│  └── estimate_accepted .......... Customer accepted the estimate            │
│                                                                             │
│  PHASE 2: CARRIER SETUP                                                     │
│  ├── verizon_submitted .......... Site request submitted to carrier         │
│  ├── verizon_in_progress ........ Carrier working on setup (1-2 weeks)      │
│  └── verizon_complete ........... Carrier site setup complete               │
│                                                                             │
│  PHASE 3: NUMBER PORTING                                                    │
│  ├── porting_submitted .......... LOA submitted for number porting          │
│  ├── porting_scheduled .......... FOC received, port date confirmed         │
│  └── porting_complete ........... Numbers successfully ported               │
│                                                                             │
│  PHASE 4: TEAMS CONFIG                                                      │
│  ├── user_config ................ Assigning numbers to users in Teams       │
│  └── completed .................. Migration complete                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Integrations

### SharePoint Migrated Locations List (via Power Automate)

PortFlow can push completed migration data into a SharePoint list using a Power Automate webhook. The "Send to SharePoint" button on each project (Phase 5 → Documentation) POSTs the migration data to a Power Automate flow, which creates the list item.

#### Step 1 — Create the SharePoint list

Create (or identify) a SharePoint list with these columns. Names must match exactly:

| Column | Type | Notes |
| --- | --- | --- |
| `Title` | Single line of text | Country name |
| `Location VOIP Name` | Single line of text | City |
| `Customer Site Address` | Single line of text | Street address |
| `Customer Legal Entity` | Single line of text | Same as address (per workflow) |
| `Local Contact` | Single line of text | Requestor email |
| `Correct Billing Address` | Single line of text | Requestor email |
| `Billing Contact` | Single line of text | Requestor email |
| `BAN` | Single line of text | Left blank by PortFlow |
| `Location ID` | Single line of text | Left blank by PortFlow |
| `Enterprise ID` | Single line of text | `124613326` for Verizon, blank otherwise |
| `Design ID` | Single line of text | `120406` for Verizon, blank otherwise |
| `Customer Status` | Single line of text or Choice | `Completed` |
| `VEC` | Single line of text or Yes/No | `yes` |
| `Location VOIP Name (Original)` | Single line of text | `<Country abbr> / <City>` |
| `Voice Provider` | Single line of text | Carrier display name |

#### Step 2 — Create the Power Automate flow

1. Go to [make.powerautomate.com](https://make.powerautomate.com) → **Create** → **Instant cloud flow**
2. Trigger: select **When an HTTP request is received**
3. Click **Use sample payload to generate schema** and paste this:

   ```json
   {
     "Title": "Germany",
     "Location VOIP Name": "Schopfheim",
     "Customer Site Address": "Hohe Flum Strasse 22",
     "Customer Legal Entity": "Hohe Flum Strasse 22",
     "Local Contact": "user@example.com",
     "Correct Billing Address": "user@example.com",
     "Billing Contact": "user@example.com",
     "BAN": "",
     "Location ID": "",
     "Enterprise ID": "124613326",
     "Design ID": "120406",
     "Customer Status": "Completed",
     "VEC": "yes",
     "Location VOIP Name (Original)": "DE / Schopfheim",
     "Voice Provider": "Verizon"
   }
   ```

4. Click **+ New step** → search **"Create item"** under **SharePoint**
5. Configure:
   - **Site Address**: your SharePoint site URL
   - **List Name**: the list created in Step 1
6. For each column in the form, click in the field and pick the matching JSON property from the **Dynamic content** panel
7. **Save** the flow
8. Re-open the HTTP trigger step and copy the **HTTP POST URL** — it'll look like `https://prod-XX.westus.logic.azure.com/workflows/.../triggers/manual/paths/invoke?...`

> **Treat this URL like a password.** Anyone with it can POST to your flow.

#### Step 3 — Configure PortFlow

1. Sign in as an admin → **Settings → Integrations**
2. Paste the URL into **Webhook URL**
3. Check **Enable SharePoint webhook**
4. Click **Save Webhook**

#### Step 4 — Send a project

1. Open any migration project → scroll to **Phase 5: Documentation**
2. Click **Send** next to "Added to Migrated Locations List"
3. The preview modal shows exactly what will be POSTed — verify, then click **Send to SharePoint**
4. The task auto-checks on success; the action is logged in the project's **History** as `migration.sharepoint_sent`

#### Troubleshooting

- **"Webhook returned 4xx"** — Open the flow's run history in Power Automate. Common issues: column names don't match, required SharePoint field left blank, or column type mismatch (e.g. trying to write text into a Choice field that doesn't have that option).
- **No flow run appears** — The URL might be wrong. Test the URL with `curl -X POST -H "Content-Type: application/json" -d '{}' "<URL>"` — you should get a 202 response.
- **"Copy Details" instead of "Send to SharePoint"** — the webhook isn't configured or isn't enabled in Settings → Integrations.

### Email Notifications (SMTP Relay)

PortFlow can send email notifications for assignments and stage transitions via any SMTP relay (no auth required — designed for internal anonymous relays).

1. **Settings → Integrations → Email Relay Configuration**
2. Enter SMTP host, port, and from-address
3. Enable email notifications
4. Use **Send Test** to verify

---

## API Reference

<details>
<summary><b>Migrations</b></summary>

```
GET    /api/migrations              List all migrations
GET    /api/migrations/dashboard    Dashboard view with progress
POST   /api/migrations              Create new migration
GET    /api/migrations/:id          Get migration details
PUT    /api/migrations/:id          Update migration
PATCH  /api/migrations/:id/stage    Update workflow stage
```

</details>

<details>
<summary><b>Workflow Actions</b></summary>

```
PATCH  /api/migrations/:id/estimate         Update cost estimate
POST   /api/migrations/:id/accept-estimate  Accept estimate
POST   /api/migrations/:id/estimate-link    Generate customer estimate link
POST   /api/migrations/:id/submit-verizon   Submit carrier request
POST   /api/migrations/:id/complete-verizon Mark carrier setup complete
POST   /api/migrations/:id/submit-loa       Submit LOA for porting
POST   /api/migrations/:id/set-foc          Set FOC and port date
POST   /api/migrations/:id/complete-porting Mark porting complete
POST   /api/migrations/:id/magic-link       Generate customer collection link
```

</details>

<details>
<summary><b>Users & Scripts</b></summary>

```
GET    /api/users                                List users
POST   /api/users                                Create user
POST   /api/users/import                         Bulk import users
GET    /api/scripts                              List generated scripts
POST   /api/scripts/generate/user-assignments   Generate assignment script
```

</details>

<details>
<summary><b>Settings & Admin</b></summary>

```
GET    /api/settings                                    List all settings
GET    /api/settings/:key                               Get setting by key
PUT    /api/settings/:key                               Update setting
GET    /api/settings/carriers                            List carriers
POST   /api/settings/carriers                            Create carrier
GET    /api/settings/voice-routing-policies              List VRPs
GET    /api/settings/dial-plans                          List dial plans
GET    /api/settings/audit-log                           Query audit log
```

</details>

<details>
<summary><b>Public Endpoints (No Auth)</b></summary>

```
GET    /api/public/estimate/:token              View estimate for acceptance
POST   /api/public/estimate/:token/accept       Accept estimate via link
GET    /api/public/collect/:token               Get migration info for data entry
POST   /api/public/collect/:token/users         Submit users via magic link
GET    /api/public/questionnaire/:token         View questionnaire
POST   /api/public/questionnaire/:token/submit  Submit questionnaire
```

</details>

---

## Docker Images

Images are automatically built and pushed to GitHub Container Registry:

```
ghcr.io/clucraft/portflow-api:latest
ghcr.io/clucraft/portflow-client:latest
```

Tagged releases create versioned images (e.g., `v0.4.0`).

---

<div align="center">

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║                              MIT License                                      ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

**Built with React, Express, and PostgreSQL**

</div>
