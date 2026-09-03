# Production Deployment Guide

## Purpose

This guide describes the safe deployment process for the Labfluss demo backend and database.

Labfluss uses Sequelize migrations for production schema changes. Production migrations should be applied intentionally and should never be mixed with test commands or seed commands.

## Production Services

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachment storage: Cloudflare R2
- Transactional email: Mailgun
- External monitoring: Better Stack

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
4. Connect to the production Lightsail host and verify the production environment configuration.
5. Check migration status.
6. Run migrations.
7. Check migration status again.
8. Clear production environment variables.
9. Redeploy or restart backend.
10. Verify production health and demo login.

## Commands

Run these commands from `labflow-backend`, not the monorepo root. Running `npx sequelize-cli` from the root may prompt to install another copy because the dependency is installed in the backend package.

Production migrations should normally be run from the AWS Lightsail backend host because the production RDS instance is private-only.

Connect to the Lightsail instance, then run:

```bash
cd /opt/labflow/labflow-backend
```

npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
npm run migrate
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js

The backend service should continue using the production environment file:

```bash
/opt/labflow/labflow-backend/.env
```

Do not export or copy the production DATABASE_URL to an unrelated local machine merely to run migrations.

Do not run tests, seed commands, or ad hoc destructive scripts against the production RDS database.

## Password Reset and Email Verification Deployment

The production schema must include the user email-verification and token-version columns, plus the password-reset-token and email-verification-token tables created by the Phase 24B migrations.

Confirm the migration is applied:

```powershell
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
```

Mailgun must be configured on the deployed backend:

```text
EMAIL_PROVIDER=mailgun
EMAIL_FROM_NAME=Labfluss
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

Labfluss attachments use private Cloudflare R2 object storage.

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
- Create an API token restricted to the Labfluss bucket where possible.
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

Expired pending attachment uploads are cleaned by a systemd timer on the AWS Lightsail backend host.

Service unit:

```text
labflow-attachment-cleanup.service
```

Timer unit:

```text
labflow-attachment-cleanup.timer
```

The service runs:

```bash
/usr/bin/npm run cleanup:attachments
```

from:

```bash
/opt/labflow/labflow-backend
```

using:

```bash
/opt/labflow/labflow-backend/.env
```

Timer configuration:

```text
OnBootSec=5min
OnUnitActiveSec=15min
Persistent=true
```

Verify the timer with:

```bash
sudo systemctl status labflow-attachment-cleanup.timer --no-pager
systemctl list-timers --all | grep labflow
```

Verify a manual cleanup execution with:

```bash
sudo systemctl start labflow-attachment-cleanup.service
sudo journalctl -u labflow-attachment-cleanup.service -n 50 --no-pager
```

A failed cleanup item should cause the run to be reported unsuccessful while allowing other candidates in the batch to be processed.

---

## Configure Cloudflare R2 CORS

Direct browser uploads use signed `PUT` requests. Cloudflare notes that browser use of presigned URLs requires a bucket CORS policy that permits the frontend’s origin and request method.

For local development and the current deployed AWS Amplify frontend, use a policy equivalent to:

```json
[
  {
    "AllowedOrigins": ["http://localhost:5173", "https://app.labfluss.com"],
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

## AWS Lightsail Backend Configuration

Current production backend:

```text
Provider: AWS Lightsail
Instance: labflow-backend-production
Region: Europe (Frankfurt)
OS: Ubuntu 24.04 LTS
Repository path: /opt/labflow
Backend path: /opt/labflow/labflow-backend
Production service: labflow-backend.service
Application port: 5000
Reverse proxy: Nginx
Production API: https://api.labfluss.com
TLS: Let's Encrypt / Certbot
Process supervision: systemd
Database connectivity: private VPC peering to Amazon RDS
```

Production environment variables are stored in:

```bash
/opt/labflow/labflow-backend/.env
```

The environment file must remain restricted and must not be committed to Git.

After backend changes:

```bash
cd /opt/labflow
git pull

sudo systemctl restart labflow-backend
sudo systemctl status labflow-backend --no-pager
```

Then verify:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://api.labfluss.com/api/health
curl -s -o /dev/null -w "%{http_code}\n" https://api.labfluss.com/api/ready
```

Both endpoints should return HTTP 200.

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
11. Trigger `labflow-attachment-cleanup.service` manually and confirm the run completes successfully.
12. Confirm `labflow-attachment-cleanup.timer` remains enabled and active.

Use only non-sensitive test files.
