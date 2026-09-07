# Production Deployment Guide

## Purpose

This guide describes the safe deployment process for the Labfluss demo backend and database.

Labfluss uses Sequelize migrations for production schema changes. Production migrations should be applied intentionally and should never be mixed with test commands or seed commands.

## Production Services

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachment storage: Amazon S3
- Transactional email: Mailgun
- External monitoring: Better Stack

## Critical Safety Rules

- Never run `npm test` against the production database.
- Never run `npm run seed` against the production database unless intentionally resetting demo data.
- Run production Sequelize CLI operations through the committed Secrets Manager-aware npm scripts rather than bypassing the wrapper with direct Sequelize CLI commands.
- Do not reinsert a long-lived database password into production `DATABASE_URL` merely to run migrations.
- Always create or confirm the appropriate recovery point before a meaningful production migration.
- Always verify backend liveness and readiness after deployment.
- Never expose production credentials in shell history, documentation, screenshots, or Git.

## Production Migration Flow

### Production migration credential path

The production application runtime uses a passwordless `DATABASE_URL`.

The RDS database password is retrieved from AWS Secrets Manager by the Sequelize runtime `beforeConnect` hook.

Production Sequelize CLI commands use the Secrets Manager-aware wrapper at `src/scripts/runSequelizeCli.js`.

For production, the wrapper retrieves the `AWSCURRENT` RDS credential from AWS Secrets Manager and injects it only into the child Sequelize CLI process environment. The production `DATABASE_URL` remains passwordless.

Production migration status is available through:

```bash
npm run migrate:status
```

Production migrations should be executed only after the normal backup/recovery-point and deployment checks:

```bash
npm run migrate
```

This credential path was verified successfully against the private production Amazon RDS database on 2026-09-07 using `npm run migrate:status`. All production migrations were reported as applied.

Do not reinsert the RDS password into production `DATABASE_URL` as the normal migration mechanism.

### Required flow before a production migration

1. Confirm relevant focused backend tests pass locally.
2. Run the full backend regression suite.
3. Review the intended migration and staged changes.
4. Commit and push the reviewed code.
5. Deploy the updated code to the authorized Lightsail backend host.
6. Install production dependencies from the committed lockfile when dependencies changed.
7. Verify current production migration status with:

   ```bash
   npm run migrate:status
   ```

8. Confirm Amazon RDS recovery capability and create or confirm the appropriate pre-migration recovery point.
9. Apply the intended migration with:

   ```bash
   npm run migrate
   ```

10. Verify migration status afterward.
11. Restart or redeploy the backend if required.
12. Verify `/api/health`.
13. Verify `/api/ready`.
14. Perform representative login and application smoke testing.
15. Review backend logs for migration or database errors.

## Commands

Run these commands from `labflow-backend`, not the monorepo root. Running `npx sequelize-cli` from the root may prompt to install another copy because the dependency is installed in the backend package.

Production migrations should normally be run from the AWS Lightsail backend host because the production RDS instance is private-only.

Connect to the Lightsail instance and change to the backend directory:

```bash
cd /opt/labflow/labflow-backend
```

### Production migration commands

Run production migration commands from:

```bash
cd /opt/labflow/labflow-backend
```

Use:

```bash
npm run migrate:status
```

to inspect migration state.

Use:

```bash
npm run migrate
```

only when an intended, reviewed production migration is ready to be applied.

These npm scripts invoke the Secrets Manager-aware wrapper at:

`src/scripts/runSequelizeCli.js`

The wrapper retrieves the current `AWSCURRENT` database credential from AWS Secrets Manager and exposes the credentialed database URL only to the child Sequelize CLI process.

The production `.env` and parent process retain the passwordless `DATABASE_URL`.

Do not use a direct Sequelize CLI invocation as the normal production migration path:

```bash
npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
```

Do not manually insert the RDS password into `DATABASE_URL`.

Production database runtime configuration includes:

```text
DATABASE_URL
DB_SECRET_ARN
DB_SECRET_REGION
DB_SECRET_ACCESS_KEY_ID
DB_SECRET_SECRET_ACCESS_KEY
```

Do not export or copy production database credentials to an unrelated local machine merely to run migrations.

Do not run tests, seed commands, or ad hoc destructive scripts against the production RDS database.

## Password Reset and Email Verification Deployment

The production schema must include the user email-verification and token-version columns, plus the password-reset-token and email-verification-token tables created by the Phase 24B migrations.

Confirm the required schema changes are present before enabling this workflow in production.

Historical or isolated recovery environments that use a complete database connection string may still use Sequelize CLI directly where appropriate.

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

Labfluss attachments use private Amazon S3 object storage.

### Required backend environment variables

Configure these values on the deployed backend service:

```text
ATTACHMENT_STORAGE_PROVIDER=s3
ATTACHMENT_MAX_FILE_SIZE_BYTES=26214400
ATTACHMENT_PENDING_TTL_MINUTES=30
ATTACHMENT_UPLOAD_URL_TTL_SECONDS=300
ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS=60
ATTACHMENT_CLEANUP_BATCH_SIZE=100

S3_BUCKET_NAME
S3_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

The AWS access key, secret key, and S3 bucket name are secrets or deployment-specific values. Do not commit them to the repository.

### S3 bucket requirements

- Keep the bucket private.
- Do not enable public bucket access.
- Use a dedicated least-privilege AWS IAM credential restricted to the Labfluss attachment bucket.
- Give the token only the object permissions required by the backend.
- Configure CORS for the deployed frontend origin.
- Do not include the AWS secret key in frontend environment variables.
- Do not expose S3 credentials through API responses.
- Do not log signed URLs.

### Attachment database migration

The attachment migrations were applied before the current passwordless production database credential architecture was introduced.

Future production attachment-related migrations must use the Secrets Manager-aware production migration procedure documented earlier in this guide.

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

## Configure Amazon S3 CORS

Direct browser uploads use signed `PUT` requests. Browser use of presigned S3 URLs requires a bucket CORS policy that permits the frontend origin and required request methods.

For local development and the current deployed AWS Amplify frontend, use a policy equivalent to:

```json
[
  {
    "AllowedOrigins": ["https://app.labfluss.com", "http://localhost:5173"],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": ["*"],
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

Presigned URLs grant temporary access to the operation encoded in the URL and should be treated as bearer credentials while valid.

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

Current database runtime configuration includes:

```text
DATABASE_URL
DB_SECRET_ARN
DB_SECRET_REGION
DB_SECRET_ACCESS_KEY_ID
DB_SECRET_SECRET_ACCESS_KEY
```

The production `DATABASE_URL` is passwordless.

The production database password is managed by Amazon RDS through AWS Secrets Manager and retrieved at runtime before Sequelize opens a new physical PostgreSQL connection.

The dedicated database-secret IAM credential is restricted to:

```text
secretsmanager:GetSecretValue
```

for the specific production RDS-managed secret.

The environment file must remain restricted and must not be committed to Git.

Verified production permissions:

```text
/opt/labflow/labflow-backend/.env
mode: 600
```

Do not create or retain unnecessary .env backup copies containing production credentials.

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
