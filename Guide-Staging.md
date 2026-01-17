We are deploying a staging environment on MAINNET with real funds, but we do NOT use Solana RPC directly.
All execution and on-chain interaction goes through Pacifica APIs.

Please prepare the project accordingly.

1) Git & Security (CRITICAL)

Push the app to Git, ensuring NO sensitive files are included.

Before the first push, review the entire repository and confirm that the following are NOT committed:

.env, .env.*, secrets, API keys, tokens

any wallet keypairs or private keys

cloud credentials (AWS/GCP/etc)

DB dumps or backups

logs with sensitive data

Ensure .gitignore is strict and complete.

Scan the repo for leaked secrets (gitleaks or similar).

If any secrets were ever committed:

rotate them

clean git history before continuing.

Deliverable: clean repo + security checklist confirmation.

2) Staging on MAINNET (Real Funds via Pacifica)

This staging environment:

Uses Pacifica mainnet APIs

Executes real trades / settlements

Uses real USDC

Required safety measures:

Wallet allowlist (initial phase)

Per-user and per-pool stake limits (backend enforced)

Backend feature flags to instantly pause:

deposits

pool creation

settlement

Clear UI warnings: “STAGING – REAL FUNDS”

Full audit logging of every Pacifica request/response

Deliverable: list of guardrails + how to configure them.

3) Infrastructure (High Traffic Ready)

Propose a production-grade infrastructure for:

frontend

backend API

database

monitoring

security

Provide:

Option A: simple & solid

Option B: more scalable

Include:

estimated monthly cost

pros/cons

scaling strategy

4) Database Migration (Local → Staging → Prod)

Move from local DB to managed Postgres (staging)

Use migrations from code (no manual changes)

Minimal seed data

Automated backups

Rollback plan

Deliverable: step-by-step migration plan.

5) Deployment Runbook

Provide a clear deployment plan:

CI/CD

environment separation

secrets management

domains + SSL

health checks

monitoring & alerts

incident response (pause system immediately)

Deliverable: concise runbook.