# Trading Fight Club

1v1 trading competitions on Pacifica perpetuals.

## Prerequisites

- **Node.js** >= 20.0.0
- **npm** >= 10.0.0
- **Docker** (for PostgreSQL database)
- **Solana wallet** (Phantom, Solflare, etc.)
- **Pacifica account** with funds deposited at [pacifica.fi](https://pacifica.fi)

## Project Structure (Simplified!)

```
tradefightclub/
├── apps/
│   └── web/          # Next.js app with API routes (single server, port 3001)
├── packages/
│   ├── db/           # Prisma database client
│   ├── logger/       # Shared logging utilities
│   ├── shared/       # Shared types and constants
│   └── tsconfig/     # Shared TypeScript configs
└── docker-compose.yml
```

**Note**: The NestJS backend has been consolidated into Next.js API routes for a simpler development experience!

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start PostgreSQL database

```bash
docker-compose up -d
```

This starts PostgreSQL on port `5433` with:
- User: `tfc`
- Password: `tfc_dev_password`
- Database: `tradefightclub`

### 3. Configure environment variables

**Server-side variables** (`apps/web/.env`):
```bash
DATABASE_URL="postgresql://tfc:tfc_dev_password@localhost:5433/tradefightclub?schema=public"
PACIFICA_API_URL=https://api.pacifica.fi
PACIFICA_BUILDER_CODE=TradeClub
JWT_SECRET=dev-jwt-secret-not-for-production
```

**Client-side variables** (`apps/web/.env.local`):
```bash
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_PACIFICA_API_URL=https://api.pacifica.fi
NEXT_PUBLIC_PACIFICA_WS_URL=wss://ws.pacifica.fi/ws
NEXT_PUBLIC_PACIFICA_BUILDER_CODE=TradeClub
```

### 4. Setup database

Generate Prisma client and push schema:

```bash
npm run db:generate
npm run db:push
```

### 5. Start the app

Simply run:

```bash
cd apps/web
npm run dev
```

That's it! One command starts everything:
- Frontend on http://localhost:3001
- API routes on http://localhost:3001/api/*

No more separate backend process!
npm run dev
```

Terminal 2 - Web:
```bash
cd apps/web
npm run dev
```

### 7. Access the app

- **Frontend**: http://localhost:3001
- **API**: http://localhost:3000/api
- **Health check**: http://localhost:3000/api/health

## Troubleshooting

### TypeScript build not generating JS files

If `apps/api/dist/` is empty or only contains `.d.ts` files:

```bash
cd apps/api
rm -f tsconfig.build.tsbuildinfo tsconfig.tsbuildinfo
rm -rf dist
npx tsc -p tsconfig.build.json
```

### Port already in use

Find and kill the process:

```bash
# Windows
netstat -ano | findstr :3000
# Then in PowerShell:
Stop-Process -Id <PID> -Force

# Mac/Linux
lsof -i :3000
kill -9 <PID>
```

### Pacifica account not detected

1. Make sure you have deposited funds on [Pacifica](https://pacifica.fi)
2. Clear browser localStorage:
   - Open DevTools (F12)
   - Go to Application → Local Storage
   - Delete `tfc-auth` entry
3. Disconnect and reconnect your wallet

### Database connection issues

Check if PostgreSQL is running:

```bash
docker ps
```

If not running:

```bash
docker-compose up -d
```

## API Endpoints

### Public

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/markets` | List all markets |
| GET | `/api/markets/prices` | Current market prices |
| GET | `/api/leaderboard` | Weekly leaderboard |

### Auth Required

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/connect` | Connect wallet |
| GET | `/api/account/summary` | Account balance & equity |
| GET | `/api/account/positions` | Open positions |
| GET | `/api/account/orders/open` | Open orders |
| POST | `/api/orders` | Place order |
| POST | `/api/fights` | Create fight |
| POST | `/api/fights/:id/join` | Join fight |

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Frontend  │────▶│   API       │────▶│  Pacifica   │
│   (Next.js) │     │   (NestJS)  │     │    API      │
└─────────────┘     └──────┬──────┘     └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │  PostgreSQL │
                   └─────────────┘
```

- **Frontend** handles wallet connection and UI
- **API** manages auth, fights, and proxies Pacifica calls
- **PostgreSQL** stores users, fights, and leaderboard data
- **Pacifica API** provides trading functionality (orders, positions, market data)

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all services in dev mode |
| `npm run build` | Build all packages |
| `npm run db:generate` | Generate Prisma client |
| `npm run db:push` | Push schema to database |
| `npm run lint` | Lint all packages |
| `npm run clean` | Clean all build outputs |

## Git Workflow

### Branch Structure

```
main ──────────────────────────────────── stable (Pacifica-only)
  │                                         ↑ PRs for hotfixes
  │                                         ↑ merge develop when multidex ready
  │
  ├── staging ─────────────────────────── Railway Staging auto-deploy
  │     ↑ merge from main (stable) or develop (multidex testing)
  │
  └── develop ─────────────────────────── multidex integration
        ↑ PRs from feature/* branches
        ├── feature/hl-deposit-withdraw
        ├── feature/lighter-adapter
        └── fix/hl-something
```

### Branch Roles

| Branch | Purpose | Deploys to | Protected |
|--------|---------|------------|-----------|
| `main` | Stable release (Pacifica-only) | Production (future) | PR required |
| `staging` | What's live on Railway | Railway Staging | PR required |
| `develop` | Multidex integration | Railway Dev (optional) | PR required |
| `feature/*`, `fix/*` | Individual work | nowhere | No |

### Daily Workflows

**Multidex feature work (most common):**
```bash
git checkout develop && git pull
git checkout -b feature/my-feature
# ... work ...
git push -u origin feature/my-feature
# → PR to develop
```

**Hotfix on stable version:**
```bash
git checkout main && git pull
git checkout -b fix/urgent-bug
# ... fix ...
git push -u origin fix/urgent-bug
# → PR to main
# Then: PR main → staging to deploy fix
```

**Test multidex on Railway staging:**
```bash
# PR develop → staging (or merge directly)
git checkout staging
git merge develop
git push origin staging
# Railway auto-deploys
```

**Ship multidex to stable (when ready):**
```bash
# PR develop → main
# After merge: PR main → staging
```

### Keeping Your Branch Up to Date

```bash
# Fetch latest changes
git fetch origin

# Rebase your branch onto its parent (DO NOT MERGE, use REBASE)
# For feature branches based on develop:
git pull origin develop --rebase

# For hotfix branches based on main:
git pull origin main --rebase

# Force push your rebased branch (your branch only, never protected branches)
git push --force-with-lease
```

### Creating & Merging Pull Requests

- Create PR from your feature branch to its target (`develop`, `main`, or `staging`)
- Keep commits focused and atomic
- Write clear commit messages
- **Always use "Squash and merge"** when merging PRs to keep history clean

### Environment Variables (Railway per-environment)

| Variable | Staging | Dev | Production (future) |
|----------|---------|-----|---------------------|
| `NEXT_PUBLIC_HYPERLIQUID_API_URL` | testnet | testnet | mainnet |
| `NEXT_PUBLIC_HYPERLIQUID_WS_URL` | testnet | testnet | mainnet |
| `DATABASE_URL` | staging DB | Dev DB | production DB |
| `NODE_ENV` | production | production | production |

No code changes needed — Railway manages env vars per service.

### Rules

- **Never push directly** to `main`, `staging`, or `develop` — always PR
- **Never merge `develop` into `main`** until multidex is fully tested
- **`staging` always reflects what's live** — merge into it deliberately
- **Never use regular merge commits** on feature branches — always rebase or squash
- **Never force push** to `main`, `staging`, or `develop`
- Use `git push --force-with-lease` (not `--force`) to safely force push feature branches
- Feature branches are short-lived — delete after merge
