# Production Deployment Guide

## Purpose

This guide describes the safe deployment process for the LabFlow demo backend and database.

LabFlow uses Sequelize migrations for production schema changes. Production migrations should be applied intentionally and should never be mixed with test commands or seed commands.

## Production Services

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL

## Critical Safety Rules

- Never run `npm test` against the production database.
- Never run `npm run seed` against the production database unless intentionally resetting demo data.
- Always check migration status before running production migrations.
- Always verify the backend health endpoint after deployment.
- Always remove local production environment variables after using them.

## Production Migration Flow

1. Confirm backend tests pass locally.
2. Commit and push code.
3. Confirm production database backup/snapshot if available.
4. Set production environment variables locally only for the current terminal session.
5. Check migration status.
6. Run migrations.
7. Check migration status again.
8. Clear production environment variables.
9. Redeploy or restart backend.
10. Verify production health and demo login.

## Commands

From `labflow-backend`:

```powershell
$env:DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL"
$env:NODE_ENV="production"

npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
npm run migrate
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js

Remove-Item Env:DATABASE_URL
Remove-Item Env:NODE_ENV
```
