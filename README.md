# PortFlow

A web application for managing Microsoft Teams Enterprise Voice migrations. PortFlow streamlines the workflow of migrating sites from legacy PBX systems to Microsoft Teams, tracking each phase from cost estimation through user configuration.

## Features

- **Migration Workflow Management**: Track migrations through all phases:
  1. Site information collection and cost estimation
  2. Verizon site setup request tracking
  3. Number porting with LOA/FOC tracking
  4. User data collection and Teams configuration

- **Customer Data Collection**: Generate secure magic links for customers to submit user data (UPN, phone numbers) without needing authentication

- **PowerShell Script Generation**: Automatically generate Teams PowerShell scripts for:
  - User phone number assignments
  - Resource account creation
  - Auto Attendant configuration
  - Call Queue setup

- **Dashboard**: Visual progress tracking for all active migrations with stage indicators and key dates

## Tech Stack

- **Frontend**: React + TypeScript + Vite + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL 16
- **Deployment**: Docker + Docker Compose

## Quick Start

### Using Pre-built Images (Recommended)

```bash
# Clone the repository
git clone https://github.com/clucraft/portflow.git
cd portflow

# Start with Docker Compose
docker-compose up -d
```

The application will be available at:
- Frontend: http://localhost:5173
- API: http://localhost:3001

### Development Setup

```bash
# Clone the repository
git clone https://github.com/clucraft/portflow.git
cd portflow

# Build from source
docker-compose -f docker-compose.dev.yml up --build
```

### Manual Development

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

# Install and run API
cd server
npm install
npm run dev

# Install and run Client (in another terminal)
cd client
npm install
npm run dev
```

## Configuration

Environment variables can be set in a `.env` file or passed to Docker Compose:

| Variable | Default | Description |
|----------|---------|-------------|
| `POSTGRES_USER` | portflow | Database username |
| `POSTGRES_PASSWORD` | portflow | Database password |
| `POSTGRES_DB` | portflow | Database name |
| `DB_PORT` | 5432 | PostgreSQL port |
| `API_PORT` | 3001 | API server port |
| `CLIENT_PORT` | 5173 | Frontend port |
| `CORS_ORIGIN` | http://localhost:5173 | Allowed CORS origin |

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
├── docker-compose.yml      # Production compose (uses ghcr.io images)
├── docker-compose.dev.yml  # Development compose (builds from source)
└── .github/
    └── workflows/
        └── docker-build.yml # GitHub Actions for Docker builds
```

## API Endpoints

### Migrations
- `GET /api/migrations` - List all migrations
- `GET /api/migrations/dashboard` - Dashboard view with progress
- `POST /api/migrations` - Create new migration
- `GET /api/migrations/:id` - Get migration details
- `PUT /api/migrations/:id` - Update migration
- `PATCH /api/migrations/:id/stage` - Update workflow stage

### Workflow Actions
- `PATCH /api/migrations/:id/estimate` - Update cost estimate
- `POST /api/migrations/:id/accept-estimate` - Accept estimate
- `POST /api/migrations/:id/submit-verizon` - Submit Verizon request
- `POST /api/migrations/:id/complete-verizon` - Mark Verizon setup complete
- `POST /api/migrations/:id/submit-loa` - Submit LOA for porting
- `POST /api/migrations/:id/set-foc` - Set FOC and port date
- `POST /api/migrations/:id/complete-porting` - Mark porting complete
- `POST /api/migrations/:id/magic-link` - Generate customer collection link

### Users
- `GET /api/users` - List users (filter by migration_id)
- `POST /api/users` - Create user
- `POST /api/users/import` - Bulk import users

### Scripts
- `GET /api/scripts` - List generated scripts
- `POST /api/scripts/generate/user-assignments` - Generate user assignment script

### Public (No Auth)
- `GET /api/public/collect/:token` - Get migration info for magic link
- `POST /api/public/collect/:token/users` - Submit users via magic link

## Workflow Stages

| Stage | Description |
|-------|-------------|
| `estimate` | Initial cost estimate phase |
| `estimate_accepted` | Customer accepted the estimate |
| `verizon_submitted` | Site request submitted to Verizon |
| `verizon_in_progress` | Verizon working on setup (1-2 weeks) |
| `verizon_complete` | Verizon site setup complete |
| `porting_submitted` | LOA submitted for number porting |
| `porting_scheduled` | FOC received, port date confirmed |
| `porting_complete` | Numbers successfully ported |
| `user_config` | Assigning numbers to users in Teams |
| `completed` | Migration complete |

## Docker Images

Images are automatically built and pushed to GitHub Container Registry on every push to `main`:

- `ghcr.io/clucraft/portflow-api:latest`
- `ghcr.io/clucraft/portflow-client:latest`

Tagged releases create versioned images (e.g., `v1.0.0`).

## License

MIT
