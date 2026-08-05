# LabFlow Production Environment

## Frontend

Provider: Vercel

Required variables:

- `VITE_API_URL`

Production frontend origin:

- `https://labflow-brown.vercel.app`

## Backend

Provider: Render

Required non-secret variables:

- `NODE_ENV`
- `PORT`
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

Provider: Neon PostgreSQL

Schema changes are managed through Sequelize migrations.

## Object Storage

Provider: Cloudflare R2

The bucket must remain private.

## Email

Provider: Mailgun

Production credentials are stored only in the Render backend environment.

## Account Security Behavior

Password-reset, email-verification, and JWT expiry values are currently defined as application constants rather than environment variables.

Current application constants:

- Password-reset token expiry: 30 minutes
- Email-verification token expiry: 24 hours
- JWT expiry: 7 days
- JWT session invalidation: database-backed `tokenVersion`

Production Mailgun configuration is required for invitation, password-reset, and email-verification delivery.

## Deployment Safety

If migrations must be run locally against Neon because the Render plan has no shell, set `DATABASE_URL` and `NODE_ENV=production` only for the active PowerShell session. Remove both variables immediately after migration and confirm `DATABASE_URL` is no longer present.

Never run `npm test` while the production database URL is active. The test helper also refuses destructive resets unless the database name contains `test`.
