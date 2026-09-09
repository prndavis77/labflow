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
- `S3_BUCKET_NAME`
- `S3_REGION`

### Database Credential Configuration

Required non-database secret variables:

- `JWT_SECRET`
- `MAILGUN_API_KEY`
- `AWS_SECRET_ACCESS_KEY`

Sensitive credential identifiers:

- `AWS_ACCESS_KEY_ID`
- `DB_SECRET_ACCESS_KEY_ID`

Sensitive deployment identifiers:

- `DB_SECRET_ARN`

Production environment-file permissions:

`/opt/labflow/labflow-backend/.env`
`mode: 600`

Secret values must not be recorded in this document.

DATABASE_URL:
Deployment configuration.
Contains PostgreSQL protocol, username, host, port, and database name.
Production URL does not contain the database password.

DB_SECRET_ARN:
Sensitive deployment identifier, not a credential by itself.

DB_SECRET_REGION:
Non-secret operational configuration.

DB_SECRET_ACCESS_KEY_ID:
Sensitive credential identifier.

DB_SECRET_SECRET_ACCESS_KEY:
Secret.

Database password:
Not stored directly in the Lightsail environment.
Retrieved at runtime from the RDS-managed AWS Secrets Manager secret.

## Database

Provider: Amazon RDS for PostgreSQL

DB instance: `labflow-production`

Database: `labflow`

Region: `eu-central-1`

Production database access is private-only through the Lightsail-to-RDS VPC peering connection.

Automated backup retention: 7 days

Schema changes are managed through Sequelize migrations.

## Monitoring and Alerting

### External Availability Monitoring

Provider: Better Stack

Production monitors:

- Frontend: `https://app.labfluss.com`
- Backend liveness: `https://api.labfluss.com/api/health`
- Backend readiness: `https://api.labfluss.com/api/ready`

Email notification delivery is verified.

### Lightsail Monitoring

The production backend instance has native Lightsail alarms for:

- CPU utilization `>= 80%`, 2 datapoints within 10 minutes
- CPU burst capacity `<= 20%`, 2 datapoints within 10 minutes
- status check failures `>= 1`, 1 datapoint within 5 minutes

Lightsail email notification delivery was verified on 2026-09-09.

### RDS Monitoring

Amazon CloudWatch monitors the production RDS instance.

Configured RDS alarms:

- CPU utilization `>= 80%` for 3 datapoints within 15 minutes
- free storage `<= 5 GiB` for 1 datapoint within 5 minutes
- freeable memory `<= 100 MiB` for 3 datapoints within 15 minutes
- database connections `>= 60` for 3 datapoints within 15 minutes

PostgreSQL currently reports:

```text
max_connections = 79
```

The database-connections warning threshold of 60 is approximately 76% of the PostgreSQL connection limit.

RDS CloudWatch alarms publish to the SNS topic:

```text
labfluss-production-alarms
```

The SNS email subscription is confirmed and the delivery path was manually verified on 2026-09-09.

No credentials or email subscription identifiers should be recorded in this document.

## Object Storage

Provider: Amazon S3

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

The production application runtime supports passwordless `DATABASE_URL` through AWS Secrets Manager.

Production Sequelize CLI operations use the Secrets Manager-aware wrapper at:

`src/scripts/runSequelizeCli.js`

The wrapper retrieves the `AWSCURRENT` RDS credential and provides the credentialed database URL only to the child Sequelize CLI process. The production `.env` and parent process remain passwordless.

The production migration credential path was verified successfully on 2026-09-07 using:

`npm run migrate:status`

Production migrations should be executed through the npm migration scripts only after the normal backup/recovery-point and deployment checks.
