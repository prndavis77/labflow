# Labfluss Production Environment

## Frontend

Provider: AWS Amplify Hosting

Required variables:

- `VITE_API_URL`

Production frontend origin:

- `https://app.labfluss.com`

## Backend

Provider: AWS Lightsail

Production backend origin:

- `https://api.labfluss.com`

Production backend path:

- `/opt/labflow/labflow-backend`

Production environment file:

- `/opt/labflow/labflow-backend/.env`

Required non-secret variables:

- `NODE_ENV`
- `FRONTEND_URL`
- `EMAIL_PROVIDER`
- `EMAIL_FROM_NAME`
- `EMAIL_FROM_ADDRESS`
- `MAILGUN_DOMAIN`
- `MAILGUN_API_BASE_URL`
- `ATTACHMENT_STORAGE_PROVIDER`
- `ATTACHMENT_MAX_FILE_SIZE_BYTES`
- `ATTACHMENT_PENDING_TTL_MINUTES`
- `ATTACHMENT_UPLOAD_URL_TTL_SECONDS`
- `ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS`
- `ATTACHMENT_CLEANUP_BATCH_SIZE`
- `R2_ACCOUNT_ID`
- `R2_BUCKET_NAME`

Required secret variables:

- `DATABASE_URL`
- `JWT_SECRET`
- `MAILGUN_API_KEY`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`

Secret values must not be recorded in this document.

## Database

Provider: Amazon RDS for PostgreSQL

DB instance: `labflow-production`

Database: `labflow`

Region: `eu-central-1`

Production database access is private-only through the Lightsail-to-RDS VPC peering connection.

Automated backup retention: 7 days

Schema changes are managed through Sequelize migrations.

## Object Storage

Provider: Cloudflare R2

The bucket must remain private.

## Email

Provider: Mailgun

Production credentials are stored only in:

`/opt/labflow/labflow-backend/.env`

The file must remain restricted and must not be committed to Git.

## Account Security Behavior

Password-reset, email-verification, and JWT expiry values are currently defined as application constants rather than environment variables.

Current application constants:

- Password-reset token expiry: 30 minutes
- Email-verification token expiry: 24 hours
- JWT expiry: 7 days
- JWT session invalidation: database-backed `tokenVersion`

Production Mailgun configuration is required for invitation, password-reset, and email-verification delivery.

## Deployment Safety

Production migrations should normally be run from the AWS Lightsail backend host because the production RDS instance is private-only.

Run migration commands from:

`/opt/labflow/labflow-backend`

using the production environment file:

`/opt/labflow/labflow-backend/.env`

Do not copy the production `DATABASE_URL` to an unrelated local machine merely to run migrations.

Never run `npm test`, seed commands, or destructive maintenance scripts against the production RDS database. The test helper also refuses destructive resets unless the database name contains `test`.
