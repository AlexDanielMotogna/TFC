# TradeFightClub - Staging Deployment Guide

> **WARNING: MAINNET STAGING WITH REAL FUNDS**
> This staging environment uses Pacifica mainnet APIs and executes real trades with real USDC.

---

## 1. Security Checklist

### 1.1 Files Verified NOT Committed

| Category | Status | Files |
|----------|--------|-------|
| Environment Variables | ✅ Excluded | `.env`, `.env.*`, `*.local` |
| Wallet Keypairs | ✅ Excluded | `*-keypair.json`, `wallet*.json` |
| Cloud Credentials | ✅ Excluded | `aws-*.json`, `gcp-*.json`, `service-account*.json` |
| Database Files | ✅ Excluded | `*.sql`, `*.dump`, `*.db` |
| Private Keys | ✅ Excluded | `*.pem`, `*.key`, `*.p12` |
| AI Tool Data | ✅ Excluded | `.claude/` |
| Build Artifacts | ✅ Excluded | `node_modules/`, `.next/`, `dist/` |

### 1.2 Code Patterns Reviewed

| Pattern | Location | Risk | Mitigation |
|---------|----------|------|------------|
| `dev-internal-key` | Multiple files | Medium | Set `INTERNAL_API_KEY` env var in staging |
| `localhost:3002` | Fallback URLs | Low | Set `REALTIME_URL` env var in staging |
| `localhost:3000` | Fallback URLs | Low | Set `NEXT_PUBLIC_API_URL` env var in staging |

### 1.3 Pre-Push Commands

```bash
# Scan for leaked secrets (run before every push)
npx gitleaks detect --source . --verbose

# Verify no .env files are staged
git status | grep -E "\.env"
```

---

## 2. Staging Guardrails (Real Funds Protection)

### 2.1 Required Environment Variables

```bash
# .env.staging (DO NOT COMMIT)

# ─────────────────────────────────────────────────────────────
# CRITICAL: Production-ready secrets
# ─────────────────────────────────────────────────────────────
INTERNAL_API_KEY=<generate-strong-random-key>
JWT_SECRET=<generate-strong-random-key>

# ─────────────────────────────────────────────────────────────
# Database
# ─────────────────────────────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/tfc_staging?schema=public

# ─────────────────────────────────────────────────────────────
# Pacifica (MAINNET)
# ─────────────────────────────────────────────────────────────
PACIFICA_API_URL=https://api.pacifica.fi
PACIFICA_WS_URL=wss://api.pacifica.fi/ws
PACIFICA_BUILDER_CODE=TradeClub

# ─────────────────────────────────────────────────────────────
# URLs
# ─────────────────────────────────────────────────────────────
NEXT_PUBLIC_API_URL=https://staging-api.tradefightclub.com
NEXT_PUBLIC_WS_URL=wss://staging-ws.tradefightclub.com
REALTIME_URL=http://realtime-internal:3002

# ─────────────────────────────────────────────────────────────
# Feature Flags
# ─────────────────────────────────────────────────────────────
FEATURE_DEPOSITS_ENABLED=true
FEATURE_POOL_CREATION_ENABLED=true
FEATURE_SETTLEMENT_ENABLED=true
FEATURE_WALLET_ALLOWLIST_ENABLED=true

# ─────────────────────────────────────────────────────────────
# Limits
# ─────────────────────────────────────────────────────────────
MAX_STAKE_PER_USER_USDC=100
MAX_STAKE_PER_FIGHT_USDC=50
```

### 2.2 Backend Feature Flags Implementation

The following flags should be implemented in the backend to instantly pause critical operations:

| Flag | Default | Description |
|------|---------|-------------|
| `FEATURE_DEPOSITS_ENABLED` | `true` | Enable/disable deposits |
| `FEATURE_POOL_CREATION_ENABLED` | `true` | Enable/disable fight creation |
| `FEATURE_SETTLEMENT_ENABLED` | `true` | Enable/disable fight settlement |
| `FEATURE_WALLET_ALLOWLIST_ENABLED` | `true` | Restrict to allowlisted wallets |

**Files to modify:**
- `apps/web/src/app/api/fights/route.ts` - Add flag checks
- `apps/web/src/app/api/orders/route.ts` - Add flag checks
- `apps/realtime/src/fight-engine.ts` - Add settlement flag

### 2.3 Wallet Allowlist

For initial staging, restrict to known test wallets:

```typescript
// apps/web/src/lib/server/auth.ts
const ALLOWED_WALLETS = process.env.ALLOWED_WALLETS?.split(',') || [];

export function isWalletAllowed(walletAddress: string): boolean {
  if (process.env.FEATURE_WALLET_ALLOWLIST_ENABLED !== 'true') {
    return true; // Allowlist disabled
  }
  return ALLOWED_WALLETS.includes(walletAddress);
}
```

### 2.4 Stake Limits (Already Implemented)

Current implementation in `apps/web/src/lib/server/orders.ts`:
- Per-fight stake limit: `fight.stakeUsdc`
- Exposure tracking: `maxExposureUsed` in `FightParticipant`

**Additional limits to add:**
```typescript
const MAX_STAKE_PER_USER = parseFloat(process.env.MAX_STAKE_PER_USER_USDC || '100');
const MAX_STAKE_PER_FIGHT = parseFloat(process.env.MAX_STAKE_PER_FIGHT_USDC || '50');
```

### 2.5 UI Warning Banner

Add to `apps/web/src/app/layout.tsx`:

```tsx
{process.env.NODE_ENV !== 'production' && (
  <div className="bg-yellow-500 text-black text-center py-2 font-bold">
    ⚠️ STAGING ENVIRONMENT - REAL FUNDS ⚠️
  </div>
)}
```

### 2.6 Audit Logging

Every Pacifica API request/response should be logged:

```typescript
// apps/web/src/lib/server/pacifica.ts
async function request<T>(method: string, endpoint: string, body?: any): Promise<T> {
  const requestId = crypto.randomUUID();

  console.log(`[Pacifica:${requestId}] ${method} ${endpoint}`, {
    timestamp: new Date().toISOString(),
    body: body ? JSON.stringify(body).substring(0, 500) : null,
  });

  try {
    const response = await fetch(url, { ... });
    const data = await response.json();

    console.log(`[Pacifica:${requestId}] Response`, {
      status: response.status,
      success: data.success,
      data: JSON.stringify(data).substring(0, 500),
    });

    return data;
  } catch (error) {
    console.error(`[Pacifica:${requestId}] Error`, { error });
    throw error;
  }
}
```

---

## 3. Infrastructure Options

### Option A: Simple & Solid (Recommended for Staging)

**Architecture:**
```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN + WAF)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────┴──────┐ ┌─────┴─────┐ ┌──────┴──────┐
       │   Vercel    │ │  Railway  │ │   Neon      │
       │  (Frontend) │ │ (Backend) │ │ (Postgres)  │
       └─────────────┘ └───────────┘ └─────────────┘
```

| Service | Component | Cost/Month |
|---------|-----------|------------|
| Vercel | Next.js Frontend | $0-20 |
| Railway | API + Realtime + Jobs | $20-50 |
| Neon | PostgreSQL | $0-25 |
| Cloudflare | CDN + SSL | $0 |
| **Total** | | **$20-95/mo** |

**Pros:**
- Fast deployment
- Auto-scaling
- Managed SSL
- Simple ops

**Cons:**
- Less control
- Vendor lock-in

### Option B: More Scalable (Production-Ready)

**Architecture:**
```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (CDN + WAF)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
       ┌──────┴──────┐ ┌─────┴─────┐ ┌──────┴──────┐
       │   Vercel    │ │    AWS    │ │    AWS      │
       │  (Frontend) │ │   (ECS)   │ │   (RDS)     │
       └─────────────┘ │           │ └─────────────┘
                       │ ┌───────┐ │
                       │ │  ALB  │ │
                       │ └───┬───┘ │
                       │ ┌───┴───┐ │
                       │ │  ECS  │ │
                       │ │Fargate│ │
                       │ └───────┘ │
                       └───────────┘
```

| Service | Component | Cost/Month |
|---------|-----------|------------|
| Vercel | Next.js Frontend | $20 |
| AWS ECS Fargate | API + Realtime | $50-100 |
| AWS RDS PostgreSQL | Database | $30-50 |
| AWS ElastiCache | Redis (optional) | $20-40 |
| AWS CloudWatch | Monitoring | $10-20 |
| **Total** | | **$130-230/mo** |

**Pros:**
- Fine-grained control
- Better scaling
- Multi-region ready
- Enterprise features

**Cons:**
- More complex
- Requires DevOps knowledge

### Recommended for Staging: Option A

Start with Option A for staging, then migrate to Option B for production when needed.

---

## 4. Database Migration Plan

### 4.1 Current State

- Local PostgreSQL
- Prisma ORM with migrations in `packages/db/prisma/`
- Schema includes: Users, Fights, FightParticipants, FightTrades, Trades, etc.

### 4.2 Migration Steps

#### Step 1: Set Up Managed PostgreSQL

**Using Neon (Recommended for Staging):**
1. Create Neon account at https://neon.tech
2. Create new project: `tfc-staging`
3. Get connection string

#### Step 2: Prepare Migration

```bash
# In packages/db directory
cd packages/db

# Generate Prisma client
npx prisma generate

# Create migration from current schema
npx prisma migrate dev --name staging_init

# Review migration file in prisma/migrations/
```

#### Step 3: Apply to Staging Database

```bash
# Set staging DATABASE_URL
export DATABASE_URL="postgresql://user:pass@host/tfc_staging?sslmode=require"

# Deploy migrations
npx prisma migrate deploy
```

#### Step 4: Seed Minimal Data (Optional)

```typescript
// packages/db/prisma/seed.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Create any required initial data
  // e.g., admin user, default settings
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

### 4.3 Backup Strategy

**Automated Backups:**
- Neon: Automatic point-in-time recovery
- AWS RDS: Automated daily backups

**Manual Backups Before Major Changes:**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql
```

### 4.4 Rollback Plan

```bash
# If migration fails:
npx prisma migrate reset --skip-seed

# Restore from backup if needed:
psql $DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

---

## 5. Deployment Runbook

### 5.1 CI/CD Pipeline

**GitHub Actions Workflow:**

```yaml
# .github/workflows/staging.yml
name: Deploy to Staging

on:
  push:
    branches: [staging]

env:
  NODE_ENV: staging

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run test

  deploy-frontend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    needs: test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: railwayapp/github-actions/deploy@main
        with:
          railway-token: ${{ secrets.RAILWAY_TOKEN }}

  migrate-db:
    needs: deploy-backend
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npx prisma migrate deploy
        env:
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
```

### 5.2 Environment Separation

| Environment | Branch | Domain | Database |
|-------------|--------|--------|----------|
| Development | `main` | localhost | Local PostgreSQL |
| Staging | `staging` | staging.tradefightclub.com | Neon staging |
| Production | `production` | tradefightclub.com | AWS RDS |

### 5.3 Secrets Management

**GitHub Secrets (Required):**
- `DATABASE_URL`
- `INTERNAL_API_KEY`
- `JWT_SECRET`
- `PACIFICA_BUILDER_CODE`
- `VERCEL_TOKEN`
- `RAILWAY_TOKEN`

**Never store in code:**
- API keys
- Database credentials
- Wallet private keys

### 5.4 Domains & SSL

| Service | Domain | SSL |
|---------|--------|-----|
| Frontend | staging.tradefightclub.com | Vercel (auto) |
| API | staging-api.tradefightclub.com | Railway (auto) |
| WebSocket | staging-ws.tradefightclub.com | Railway (auto) |

### 5.5 Health Checks

**API Health Endpoint:**
```typescript
// apps/web/src/app/api/health/route.ts
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return Response.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ status: 'error', error: 'Database connection failed' }, { status: 500 });
  }
}
```

**Monitoring:**
- Vercel Analytics (frontend)
- Railway Metrics (backend)
- Sentry (error tracking)

### 5.6 Incident Response

**Emergency Pause Procedure:**

1. **Immediate:** Set feature flags to disable operations
   ```bash
   # In Railway/hosting dashboard, set:
   FEATURE_DEPOSITS_ENABLED=false
   FEATURE_POOL_CREATION_ENABLED=false
   FEATURE_SETTLEMENT_ENABLED=false
   ```

2. **Notify:** Alert team via Slack/Discord

3. **Investigate:** Check logs in Railway/Vercel

4. **Fix:** Deploy hotfix or rollback

5. **Resume:** Re-enable feature flags after fix

---

## Quick Reference

### Deploy Commands

```bash
# Push to staging
git push origin staging

# Deploy DB migrations
cd packages/db && npx prisma migrate deploy

# Check logs
railway logs
vercel logs
```

### Emergency Commands

```bash
# Pause all operations (in hosting dashboard)
FEATURE_DEPOSITS_ENABLED=false
FEATURE_POOL_CREATION_ENABLED=false
FEATURE_SETTLEMENT_ENABLED=false

# Rollback deployment
git revert HEAD
git push origin staging

# Database rollback
npx prisma migrate reset
```

---

**Last Updated:** 2026-01-17
**Author:** Claude Code
