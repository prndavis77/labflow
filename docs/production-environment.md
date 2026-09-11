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
- `BACKUP_S3_BUCKET`
- `BACKUP_S3_REGION`

### Database Credential Configuration

Required non-database secret variables:

- `JWT_SECRET`
- `MAILGUN_API_KEY`
- `AWS_SECRET_ACCESS_KEY`
- `BACKUP_AWS_SECRET_ACCESS_KEY`

Sensitive credential identifiers:

- `AWS_ACCESS_KEY_ID`
- `DB_SECRET_ACCESS_KEY_ID`
- `BACKUP_AWS_ACCESS_KEY_ID`

Sensitive deployment identifiers:

- `DB_SECRET_ARN`
- `BACKUP_ALERT_SNS_TOPIC_ARN`

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

BACKUP_AWS_ACCESS_KEY_ID:
Sensitive credential identifier for the dedicated production backup IAM identity.

BACKUP_AWS_SECRET_ACCESS_KEY:
Secret for the dedicated production backup IAM identity.

BACKUP_S3_BUCKET:
Non-secret deployment configuration identifying the production backup bucket.

BACKUP_S3_REGION:
Non-secret operational configuration for the production backup bucket region.

BACKUP_ALERT_SNS_TOPIC_ARN:
Sensitive deployment identifier for the SNS topic used by backup-failure notifications.
It is not an authentication secret by itself.

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

Automated logical backup: daily PostgreSQL custom-format backup from the Lightsail host

Logical backup schedule:

```text
02:30 UTC daily
Randomized delay: up to 10 minutes
Persistent timer: enabled
```

Logical backups are stored in the separate versioned production backup bucket.

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

### Backup Failure Monitoring

Both automated production backup services use systemd `OnFailure` handling.

Database backup service:

```text
labflow-database-backup.service
```

Attachment backup service:

```text
labflow-attachment-backup.service
```

Failure-notification template:

```text
labflow-backup-failure-notify@.service
```

Notification script:

```text
src/scripts/notifyBackupFailure.js
```

Notification destination:

```text
labfluss-production-alarms
```

The notifier uses the dedicated production backup IAM identity.

A controlled disposable systemd failure test verified:

```text
systemd failure
-> OnFailure
-> backup notifier
-> successful SNS publish
```

The disposable test service was removed after verification.

A complete Lightsail host outage may prevent the local notifier from running. The independent Lightsail status-check alarm provides separate host-level failure detection.

## Object Storage

Provider: Amazon S3

### Production Attachment Bucket

Bucket:

```text
labfluss-attachments-production
```

Region:

```text
eu-central-1
```

Requirements:

- private
- public access blocked
- BucketOwnerEnforced object ownership
- SSE-S3 default encryption
- production application IAM access restricted to required attachment operations

### Production Backup Bucket

Bucket:

```text
labfluss-production-backups
```

Region:

```text
eu-central-1
```

Requirements:

- private
- public access blocked
- BucketOwnerEnforced object ownership
- versioning enabled
- SSE-S3 default encryption
- separate from the production attachment bucket

The dedicated backup IAM identity can:

- list the backup bucket
- read and write backup objects
- list the production attachment bucket
- read production attachment objects
- retrieve the exact production RDS secret from Secrets Manager
- publish backup-failure notifications to the production SNS alarm topic

The backup IAM identity does not have `s3:DeleteObject`.

### Backup Object Namespaces

Database backups:

```text
database/YYYY/MM/DD/labfluss-production-<timestamp>.dump
```

Attachment backups:

```text
attachments/current/<original-production-storage-key>
```

### Backup Retention

Database backups:

- current versions expire after 35 days
- resulting noncurrent versions are permanently deleted after 1 additional day
- effective retained period is approximately 35 to 36 days

Attachment backups:

- current versions do not expire
- overwritten noncurrent versions are retained for 35 days
- source deletions are not propagated to the backup bucket

This preserves the latest attachment backup while retaining limited historical versions.

## Automated Backup Scheduling

Automated backups run on the production AWS Lightsail host through systemd.

Database backup:

```text
Service: labflow-database-backup.service
Timer: labflow-database-backup.timer
Command: /usr/bin/npm run backup:database
Working directory: /opt/labflow/labflow-backend
Environment file: /opt/labflow/labflow-backend/.env
Schedule: 02:30 UTC daily
Randomized delay: up to 10 minutes
Persistent: true
```

Attachment backup:

```text
Service: labflow-attachment-backup.service
Timer: labflow-attachment-backup.timer
Command: /usr/bin/npm run backup:attachments
Working directory: /opt/labflow/labflow-backend
Environment file: /opt/labflow/labflow-backend/.env
Schedule: 03:00 UTC daily
Randomized delay: up to 10 minutes
Persistent: true
```

Both timers are enabled and active.

The database and attachment schedules are intentionally separated so the jobs do not normally execute simultaneously.

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

Production backup operations must use the dedicated backup credential path rather than the normal application S3 credential.

The production database backup must continue to obtain the current PostgreSQL password from AWS Secrets Manager rather than storing the password directly in `DATABASE_URL`.

Do not manually delete objects from the production backup bucket as a routine retention mechanism. Retention is managed through S3 lifecycle configuration.
