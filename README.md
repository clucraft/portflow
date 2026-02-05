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
│  • Support for Verizon, FusionConnect, and GTT carriers                     │
│  • Direct Routing and Operator Connect support                              │
│  • Real-time progress tracking with terminal-style indicators               │
│                                                                             │
├─ Customer Portal ───────────────────────────────────────────────────────────┤
│                                                                             │
│  • Shareable estimate acceptance links (no login required)                  │
│  • Magic links for customer data collection                                 │
│  • CSV upload support with flexible column mapping                          │
│                                                                             │
├─ Script Generation ─────────────────────────────────────────────────────────┤
│                                                                             │
│  • Auto-generate Teams PowerShell scripts                                   │
│  • User phone number assignments                                            │
│  • Resource account creation                                                │
│  • Auto Attendant & Call Queue configuration                                │
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

### Using Docker (Recommended)

```bash
# Clone the repository
git clone https://github.com/clucraft/portflow.git
cd portflow

# Start with Docker Compose
docker-compose up -d
```

```
┌─ Access Points ─────────────────────────────────────────────────────────────┐
│                                                                             │
│  Frontend ............................................. http://localhost:80 │
│  API ................................................ http://localhost:3001 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

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
│  CORS_ORIGIN         http://localhost:5173    Allowed CORS origin           │
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
<summary><b>Public Endpoints (No Auth)</b></summary>

```
GET    /api/public/estimate/:token         View estimate for acceptance
POST   /api/public/estimate/:token/accept  Accept estimate via link
GET    /api/public/collect/:token          Get migration info for magic link
POST   /api/public/collect/:token/users    Submit users via magic link
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
