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

Run these commands from `labflow-backend`, not the monorepo root. Running `npx sequelize-cli` from the root may prompt to install another copy because the dependency is installed in the backend package.

When the hosting plan does not provide a backend shell, migrations may be run from a local PowerShell session that is temporarily pointed at the production database:

```powershell
$env:DATABASE_URL="YOUR_PRODUCTION_DATABASE_URL"
$env:NODE_ENV="production"

npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
npm run migrate
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js

Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
Remove-Item Env:NODE_ENV -ErrorAction SilentlyContinue
```

Confirm the temporary production URL is gone:

```powershell
[bool]$env:DATABASE_URL
```

Expected:

```text
False
```

Do not run tests, seed commands, or ad hoc destructive scripts while the production `DATABASE_URL` is active.

## Password Reset and Email Verification Deployment

The production schema must include the user email-verification and token-version columns, plus the password-reset-token and email-verification-token tables created by the Phase 24B migrations.

Confirm the migration is applied:

```powershell
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
```

Mailgun must be configured on the deployed backend:

```text
EMAIL_PROVIDER=mailgun
EMAIL_FROM_NAME=LabFlow
EMAIL_FROM_ADDRESS=<verified sender>
MAILGUN_API_KEY=<secret>
MAILGUN_DOMAIN=<configured domain>
MAILGUN_API_BASE_URL=https://api.mailgun.net
```

Use `https://api.eu.mailgun.net` for an EU-region Mailgun domain.

### Completed production verification

1. Register a new workspace.
2. Confirm the administrator is authenticated but marked unverified.
3. Confirm normal workspace API calls return `403 EMAIL_VERIFICATION_REQUIRED`.
4. Confirm the initial verification email arrives.
5. Use Resend Verification Email and confirm a replacement message arrives.
6. Verify the email through the explicit confirmation button.
7. Confirm the user returns to the dashboard without logging in again.
8. Confirm protected workspace data loads and the unverified banner disappears.

### Remaining production verification

1. Request a password-reset email.
2. Confirm the password-reset email arrives and opens the deployed frontend route.
3. Complete the reset.
4. Confirm an older JWT returns `401 SESSION_INVALIDATED`.
5. Confirm the frontend removes the old token, redirects to login, and shows the notice once.
6. Refresh the login page and confirm the notice does not repeat.
7. Log in with the new password and confirm the fresh JWT works.

Do not record raw reset or verification tokens in logs or documentation.

## Attachment Storage Deployment

LabFlow attachments use private Cloudflare R2 object storage.

### Required backend environment variables

Configure these values on the deployed backend service:

```text
ATTACHMENT_STORAGE_PROVIDER=r2
ATTACHMENT_MAX_FILE_SIZE_BYTES=26214400
ATTACHMENT_PENDING_TTL_MINUTES=30
ATTACHMENT_UPLOAD_URL_TTL_SECONDS=300
ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS=60
ATTACHMENT_CLEANUP_BATCH_SIZE=100

R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

The R2 account ID, access key, secret key, and bucket name are secrets or deployment-specific values. Do not commit them to the repository.

### R2 bucket requirements

- Keep the bucket private.
- Do not enable public bucket access.
- Create an API token restricted to the LabFlow bucket where possible.
- Give the token only the object permissions required by the backend.
- Configure CORS for the deployed frontend origin.
- Do not include the R2 secret key in frontend environment variables.
- Do not expose R2 credentials through API responses.
- Do not log signed URLs.

### Attachment database migration

Before enabling attachment routes in production:

```powershell
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
npm run migrate
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
```

Confirm that the attachment migration is listed as applied.

### Cleanup scheduling

Run:

```bash
npm run cleanup:attachments
```

as a scheduled one-shot job.

The scheduled service must use the same database and R2 environment variables as the backend API.

Monitor the exit status and logs. A failed cleanup item should cause the run to be marked unsuccessful while allowing other candidates in the batch to be processed.

---

## Configure Cloudflare R2 CORS

Direct browser uploads use signed `PUT` requests. Cloudflare notes that browser use of presigned URLs requires a bucket CORS policy that permits the frontend’s origin and request method.

For local development and the current deployed Vercel frontend, use a policy equivalent to:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:5173",
      "https://labflow-brown.vercel.app"
    ],
    "AllowedMethods": ["PUT", "GET", "HEAD"],
    "AllowedHeaders": [
      "Content-Type",
      "x-amz-checksum-sha256",
      "x-amz-content-sha256"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

Only include headers that the frontend actually sends.

If your generated upload request requires a different signed header, add that exact header to AllowedHeaders.

Do not use:

"AllowedOrigins": ["*"]

for a production deployment with a known frontend domain.

Presigned URLs grant temporary access to the operation encoded in the URL, and Cloudflare recommends treating them as bearer tokens.

## Render Backend Configuration

Add the following environment variables to the Render backend service:

```text
ATTACHMENT_STORAGE_PROVIDER=r2
ATTACHMENT_MAX_FILE_SIZE_BYTES=26214400
ATTACHMENT_PENDING_TTL_MINUTES=30
ATTACHMENT_UPLOAD_URL_TTL_SECONDS=300
ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS=60
ATTACHMENT_CLEANUP_BATCH_SIZE=100
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
```

Enter the R2 account ID, access key, secret key, and bucket name using the real Cloudflare values.

The R2 credentials must be available only to the backend and cleanup job. They must never be added to frontend environment variables.

## Render Attachment Cleanup Job

Create a separate Render Cron Job for expired pending uploads.

Suggested name:

```text
labflow-attachment-cleanup
```

Command:

```bash
npm run cleanup:attachments
```

Suggested schedule:

```cron
*/15 * * * *
```

The cleanup job must use the same DATABASE_URL and R2 environment variables as the backend service.

The cleanup command is a one-shot process. It must not be added to the normal backend startup command.

The backend service should continue to use:

```bash
npm start
```

After creating the cron job, trigger one manual run.

Expected output when no expired uploads exist:

```text
Starting expired attachment cleanup.
Expired attachment cleanup completed. {
  scanned: 0,
  cleaned: 0,
  skipped: 0,
  failed: 0
}
```

## Attachment Deployment Verification

After deploying the backend:

1. Verify `GET /api/health`.
2. Initiate a test attachment upload.
3. Upload the file through the signed URL.
4. Complete the upload.
5. List the target record’s attachments.
6. Request a signed download URL.
7. Download the object.
8. Update its category or description.
9. Archive the attachment.
10. Confirm that archived attachments are excluded from normal reads.
11. Trigger the pending-upload cleanup job.

Use only non-sensitive test files.
