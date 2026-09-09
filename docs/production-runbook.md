# Labfluss Production Runbook

## Purpose

This runbook describes how to diagnose and respond to operational problems in the deployed Labfluss application.

It is intended for the current Labfluss production/demo environment.

Labfluss is currently suitable for portfolio demonstrations, controlled pilot demonstrations, invited testers, and non-sensitive test data. This runbook does not imply readiness for regulated or sensitive research data.

## Production Services

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachment storage: Amazon S3
- Transactional email: Mailgun
- External uptime monitoring: Better Stack

## Production URLs

Frontend:

```text
https://app.labfluss.com
```

Backend liveness:

https://api.labfluss.com/api/health

Backend readiness:

https://api.labfluss.com/api/ready

## Health Model

Labfluss uses separate liveness and readiness checks.

### Liveness

`GET /api/health`

Expected response:

```json
{
  "status": "success",
  "message": "Labfluss API is running"
}
```

A successful liveness response means the Node/Express application is reachable.

It does not prove that PostgreSQL is reachable.

### Readiness

`GET /api/ready`

Expected healthy response:

```json
{
  "status": "success",
  "message": "Labfluss API is ready",
  "checks": {
    "database": "ready"
  }
}
```

A successful readiness response means the backend can currently communicate with PostgreSQL.

If PostgreSQL cannot be reached, readiness returns HTTP 503 with a safe response that does not expose database internals.

## Operational Monitoring and Alerting

Labfluss uses layered monitoring so that application availability and infrastructure resource problems can be distinguished quickly.

### Better Stack Availability Monitoring

Better Stack monitors:

1. Production frontend: `https://app.labfluss.com`
2. Backend liveness: `https://api.labfluss.com/api/health`
3. Backend readiness: `https://api.labfluss.com/api/ready`

The readiness monitor is the primary backend dependency signal because it detects both backend availability and PostgreSQL connectivity failures.

Current monitoring cadence:

| Monitor           | Check interval | Confirmation | Recovery  |
| ----------------- | -------------- | ------------ | --------- |
| Frontend          | 3 minutes      | 1 minute     | 3 minutes |
| Backend readiness | 3 minutes      | 1 minute     | 3 minutes |
| Backend liveness  | 5 minutes      | 1 minute     | 3 minutes |

TLS certificate verification is enabled.

Advance SSL-certificate-expiration and domain-expiration alerting are not available on the current Better Stack plan.

Better Stack email alert delivery has been verified by a real readiness incident that returned HTTP 503.

### AWS Lightsail Resource Alerts

The production Lightsail instance uses native Lightsail alarms for the following conditions:

| Alarm                  | Threshold      | Evaluation                     |
| ---------------------- | -------------- | ------------------------------ |
| CPU utilization high   | `>= 80%`       | 2 datapoints within 10 minutes |
| CPU burst capacity low | `<= 20%`       | 2 datapoints within 10 minutes |
| Status check failure   | `>= 1` failure | 1 datapoint within 5 minutes   |

Email notification is enabled for these alarms.

The Lightsail notification path was manually verified on 2026-09-09 using the CPU burst-capacity alarm. An AWS alarm notification was successfully delivered by email.

Network traffic alarms are not currently configured because network throughput is not an actionable pilot-stage failure signal.

Memory and disk utilization are not currently collected as native Lightsail alarm metrics. Installing an additional monitoring agent is deferred until operational evidence justifies the added complexity.

### Amazon RDS CloudWatch Alerts

Production RDS resource monitoring uses Amazon CloudWatch.

Configured alarms:

| Alarm                                  | Metric                | Threshold           | Evaluation                     |
| -------------------------------------- | --------------------- | ------------------- | ------------------------------ |
| Labfluss RDS CPU High                  | `CPUUtilization`      | `>= 80%`            | 3 datapoints within 15 minutes |
| Labfluss RDS Free Storage Low          | `FreeStorageSpace`    | `<= 5 GiB`          | 1 datapoint within 5 minutes   |
| Labfluss RDS Freeable Memory Low       | `FreeableMemory`      | `<= 100 MiB`        | 3 datapoints within 15 minutes |
| Labfluss RDS Database Connections High | `DatabaseConnections` | `>= 60 connections` | 3 datapoints within 15 minutes |

The PostgreSQL production instance currently reports:

```text
max_connections = 79
```

RDS alarm notifications are routed through the SNS topic:

```text
labfluss-production-alarms
```

The SNS email subscription is confirmed.

The CloudWatch/SNS delivery path was manually verified on 2026-09-09 by publishing a test notification through the production alarm topic and confirming successful email delivery.

### Alert Routing Verification

As of 2026-09-09:

| Alert path               | Status   | Verification                          |
| ------------------------ | -------- | ------------------------------------- |
| Better Stack email       | Verified | Real `/api/ready` HTTP 503 incident   |
| CloudWatch → SNS → email | Verified | Manual SNS topic publish              |
| Lightsail → email        | Verified | CPU burst-capacity alarm notification |

Production resource load was not intentionally increased merely to test alerting.

A successful SNS publish verifies the notification-delivery path. It does not by itself prove that every CloudWatch metric alarm will transition correctly under a real failure condition.

## Incident Triage

### Frontend down, health and readiness up

Likely area:

- AWS Amplify deployment
- frontend asset delivery
- frontend routing
- frontend configuration

Check:

1. AWS Amplify deployment status.
2. Browser network errors.
3. VITE_API_URL.
4. Recent frontend deployment.
5. Whether the backend URLs remain healthy.

### Health down and readiness down

Likely area:

- AWS Lightsail service unavailable
- backend crash
- deployment failure
- startup failure
- networking or hosting issue

Check:

1. AWS Lightsail instance status.
2. `labflow-backend.service` status.
3. systemd journal logs for `labflow-backend.service`.
4. Backend startup logs.
5. Recent commits and deployments.
6. Missing or invalid production environment variables.

### Health up, readiness down

Likely area:

- PostgreSQL connectivity
- Amazon RDS availability
- database credentials
- SSL configuration
- connection exhaustion
- database networking

Check:

1. Amazon RDS DB instance status.
2. Backend journal for database connection errors.
3. Confirm DB_SECRET_ARN is configured.
4. Confirm DB_SECRET_REGION is correct.
5. Confirm DB_SECRET_ACCESS_KEY_ID and DB_SECRET_SECRET_ACCESS_KEY are present.
6. Confirm the dedicated IAM credential still has secretsmanager:GetSecretValue for the exact RDS-managed secret.
7. Check whether RDS/Secrets Manager recently rotated the database credential.
8. Do not copy the RDS password back into DATABASE_URL as the normal remediation.
9. Verify private Lightsail-to-RDS networking and TLS if credentials are healthy.

Do not weaken TLS/SSL validation merely to suppress connection warnings.

### Frontend up, readiness up, application feature failing

Likely area:

- application/controller error
- authorization
- external dependency such as S3 or Mailgun
- data-specific failure

Use the request correlation ID from the failed API request where available.

Search the Lightsail backend journal for the same `requestId`.

A useful concrete command is:

```bash
sudo journalctl -u labflow-backend.service --since "30 minutes ago"
```

## Structured Logging

Production backend logs use structured JSON.

Useful fields include:

- service
- environment
- event
- requestId
- userId
- organizationId
- context
- err
- method
- path
- statusCode
- durationMs

Use requestId to correlate:

1. the HTTP request-completion log
2. the application/controller error log
3. related operational investigation

Do not record or copy secrets into tickets, documentation, screenshots, or logs.

Sensitive values that must not be intentionally logged include:

- passwords
- JWTs
- reset tokens
- verification tokens
- invitation tokens
- authorization headers
- cookies
- database credentials
- Mailgun API keys
- S3 credentials
- signed upload URLs
- signed download URLs
- email message bodies

## Email Delivery Failures

Central email delivery events include:

email_delivery_succeeded
email_delivery_skipped
email_delivery_failed

Email logs identify provider and message tags without intentionally logging recipient addresses, subjects, bodies, links, or provider message IDs.

Feature-specific controllers may also log contextual delivery failures.

If email delivery fails:

1. Check the Lightsail backend journal for `email_delivery_failed`.
2. Check the associated feature-specific event.
3. Check Mailgun status and configuration.
4. Verify the configured domain and sender.
5. Confirm MAILGUN_API_KEY, domain, and API base URL are present.
6. Do not expose reset, verification, or invitation tokens while troubleshooting.

## Attachment Cleanup Failures

Attachment cleanup failure events include:

`attachment_cleanup_item_failed`
`attachment_cleanup_rollback_failed`

A failed item should not prevent other cleanup candidates from being attempted.

If cleanup failures occur:

1. Check the attachment ID in structured log context.
2. Check database availability.
3. Check Amazon S3 availability and credentials.
4. Verify the object-storage configuration.
5. Do not log or expose the attachment storage key unnecessarily.
6. Do not expose signed URLs.
7. Check `labflow-attachment-cleanup.timer`.
8. Check `labflow-attachment-cleanup.service`.
9. Review the cleanup journal for the failed execution.

Useful commands:

```bash
sudo systemctl status labflow-attachment-cleanup.timer --no-pager
sudo systemctl status labflow-attachment-cleanup.service --no-pager
sudo journalctl -u labflow-attachment-cleanup.service -n 100 --no-pager
```

## HTTP 500 Investigation

When an API request returns HTTP 500:

1. Capture the response requestId if present.
2. Search the Lightsail backend journal for that request ID.
3. Find the structured application error event.
4. Identify the controller/service involved.
5. Reproduce locally with non-sensitive test data if practical.
6. Add a regression test before closing the defect.
7. Deploy only after focused and full regression tests pass.

Do not expose internal stack traces or database details to the client as part of debugging.

## Deployment Verification

Before deployment:

1. Run relevant focused tests.
2. Run the full backend regression suite for backend changes.
3. Run frontend lint/build for frontend changes.
4. Run git diff --check.
5. Review staged changes.
6. Confirm no secrets are staged.

After deployment:

1. Confirm the AWS Lightsail backend update completed successfully.
2. Confirm the AWS Amplify deployment succeeds if the frontend changed.
3. Confirm `labflow-backend.service` is active.
4. Confirm `GET /api/health` returns HTTP 200.
5. Confirm `GET /api/ready` returns HTTP 200.
6. Confirm Better Stack reports all permanent monitors as Up.
7. Check the Lightsail backend journal for startup or repeated error events.
8. Perform a basic login and application load.
9. Verify the changed production workflow when applicable.

## Production Database Safety

Never run tests against the production database.

Never run seed commands against production unless intentionally resetting demo data.

### Production Migration Credential Path

The running production API retrieves the current RDS credential from AWS Secrets Manager through the Sequelize runtime `beforeConnect` hook.

Production Sequelize CLI commands use the Secrets Manager-aware wrapper at:

```text
src/scripts/runSequelizeCli.js
```

For production, the wrapper:

1. reads the passwordless production DATABASE_URL
2. retrieves the AWSCURRENT RDS credential from AWS Secrets Manager
3. constructs a credentialed database URL only in memory
4. passes that URL only to the child Sequelize CLI process
5. leaves the parent process and production .env passwordless

Production migration status is available through:

```bash
npm run migrate:status
```

The production credential path was verified successfully against the private Amazon RDS database on 2026-09-07.

Do not bypass the wrapper by running Sequelize CLI directly against production.

Do not reinsert the RDS password into `DATABASE_URL`.

Before a production schema migration:

1. confirm relevant focused tests pass
2. confirm the full backend regression suite passes
3. review the intended migration
4. verify current production migration status with `npm run migrate:status`
5. create or confirm the appropriate pre-migration recovery point
6. run the intended migration with `npm run migrate`
7. verify migration status afterward
8. verify `/api/health`
9. verify `/api/ready`
10. perform representative application smoke testing
11. review backend logs for migration or database errors

See:

`docs/production-deployment.md`

for the full migration procedure.

## Backup and Disaster Recovery

Detailed backup, restore, and disaster-recovery procedures are maintained in:

`docs/backup-recovery.md`

Current recovery objectives for the demo/pilot deployment are:

```text
Target RPO: 24 hours or less
Target RTO: 4 hours
```

Current verified recovery capabilities include:

- Amazon RDS automated backups with a 7-day retention window
- Amazon RDS point-in-time recovery within the retained backup window
- a post-cutover manual Amazon RDS DB snapshot
- portable PostgreSQL logical backups
- a successfully tested isolated PostgreSQL logical restore
- independent dated attachment backups retained outside production object storage
- SHA-256 attachment-integrity verification
- historically tested representative object recovery in isolated R2 storage
- verified R2-to-S3 attachment migration integrity with SHA-256 checks
- successfully completed PostgreSQL/attachment-backup reconciliation
- successfully completed application-level validation against the recovered database

During a database or attachment-recovery incident:

1. Do not overwrite production merely to test recovery.
2. Preserve the current production state before destructive recovery where practical.
3. Prefer isolated recovery infrastructure before production cutover.
4. Select the appropriate PostgreSQL recovery point and recovery method.
5. Validate schema, migration state, relational data, and application access.
6. Reconcile recovered PostgreSQL attachment metadata with the required attachment objects.
7. Recreate configuration and credentials as documented when infrastructure has been lost.
8. Perform production cutover only after the recovery target has passed validation.

A production cutover was intentionally not performed during the Phase 25B.7 recovery drill.

Current recovery limitations include:

- automated daily attachment backups are not yet implemented
- the independent attachment backup is currently stored locally
- no off-machine or off-provider attachment backup copy is currently configured
- production infrastructure reconstruction has not been drill-tested
- production recovery cutover has not been drill-tested

For detailed recovery method selection, restore commands, attachment reconciliation, configuration reconstruction, validation criteria, and recovery evidence requirements, use `docs/backup-recovery.md`.

## Test Database Safety

The test database guard must not be weakened.

If tests cannot establish that they are using the test database, fix the test environment rather than bypassing the guard.

Never point Jest or integration tests at the production Amazon RDS database.

## Security During Incident Response

Do not:

- paste secrets into logs
- commit environment files
- publish production credentials
- expose signed URLs
- expose raw authentication or account-security tokens
- disable database safety guards
- weaken TLS solely to remove warnings
- use production data for local reproduction when synthetic data is sufficient

## Alert Response

When an alert arrives:

1. Identify the monitoring source and failed signal.
2. Determine whether the alert is an availability failure or a resource-capacity warning.
3. Compare frontend, liveness, and readiness states when application availability is affected.
4. Use the health/readiness matrix in this runbook.
5. Check AWS Lightsail, Amazon RDS, or AWS Amplify depending on the failure pattern.
6. Review structured backend logs and request IDs for application failures.
7. Begin investigation before acknowledging or dismissing the alert.
8. Confirm that the affected monitor returns to its normal state after remediation.

### Better Stack Alerts

Interpret Better Stack failures as follows:

- Frontend down while health and readiness remain up: investigate AWS Amplify, frontend DNS/TLS, or frontend deployment.
- Readiness down while health remains up: investigate PostgreSQL, database credentials, database networking, or another readiness dependency.
- Health and readiness both down: investigate Lightsail, Nginx, the backend service, or backend networking.

### Lightsail Alerts

For high CPU utilization:

1. Check current CPU utilization and burst capacity.
2. Check `labflow-backend.service`.
3. Review recent backend traffic and journal logs.
4. Look for repeated application errors, runaway work, or unexpectedly expensive requests.

For low CPU burst capacity:

1. Check whether CPU utilization has remained elevated.
2. Check whether the workload increase is expected.
3. Review backend activity and scheduled jobs.
4. Consider instance sizing only if sustained production workload justifies it.

For a status-check failure:

1. Check the Lightsail instance state.
2. Check AWS service health if appropriate.
3. Confirm network reachability.
4. Verify `labflow-backend.service` after instance recovery.
5. Verify `/api/health` and `/api/ready`.

### RDS CloudWatch Alerts

For high CPU:

1. Check RDS CPU utilization and DB load.
2. Check active database connections.
3. Review application traffic and expensive operations.
4. Review relevant PostgreSQL or application errors.

For low free storage:

1. Check current free-storage trend.
2. Determine whether growth is expected.
3. Review storage allocation and autoscaling configuration before capacity becomes critical.
4. Do not wait until storage reaches zero before acting.

For low freeable memory:

1. Review the memory trend rather than a single datapoint.
2. Check concurrent database activity and DB load.
3. Check for accompanying CPU or connection pressure.
4. Consider instance sizing only after confirming sustained resource pressure.

For high database connections:

1. Check the current `DatabaseConnections` metric and trend.
2. Compare the connection count with the PostgreSQL `max_connections` value of 79.
3. Check backend logs for connection-acquisition, timeout, or database errors.
4. Check whether application traffic or concurrent operations increased unexpectedly.
5. Confirm connections are being returned to the Sequelize pool normally.
6. Investigate sustained growth before the connection limit is reached.
7. Do not increase `max_connections` merely to suppress the alarm without first identifying the source of connection pressure.

### September 2026 Readiness Incident

The 2026-09-05 database credential-rotation incident demonstrated that the
liveness/readiness split works as intended.

During the incident:

- `/api/health` remained HTTP 200
- `/api/ready` returned HTTP 503
- the Node.js process remained running
- PostgreSQL authentication failed
- Better Stack detected the readiness outage

The incident remained unresolved for approximately 15 hours and 32 minutes.

The incident demonstrated that outage detection functioned correctly but also exposed the need to verify alert routing before the paid pilot. That follow-up was completed on 2026-09-09:

- Better Stack email delivery is verified.
- CloudWatch/SNS email delivery is verified.
- Lightsail alarm email delivery is verified.

## Current Monitoring Interpretation

| Frontend | Health | Readiness | Likely interpretation                     |
| -------- | ------ | --------- | ----------------------------------------- |
| Up       | Up     | Up        | Core platform available                   |
| Down     | Up     | Up        | Frontend/AWS Amplify issue                |
| Up       | Up     | Down      | Database/dependency issue                 |
| Up       | Down   | Down      | Backend/AWS Lightsail issue               |
| Down     | Down   | Down      | Broad deployment or infrastructure outage |

## Known Operational Boundaries

The current Labfluss deployment is not yet intended for:

- regulated laboratory records
- sensitive research data
- institutional production workloads
- guaranteed uptime/SLA workloads

Backup and recovery hardening has been completed for the current demo/pilot stage, including an isolated PostgreSQL restore drill and attachment-recovery reconciliation.

Frontend end-to-end testing and the operational-alerting baseline are also complete.

Remaining pre-pilot hardening includes automated and off-provider attachment backups, transactional-email production cleanup, and final customer/compliance readiness work.

## Related Documentation

- docs/production-deployment.md
- docs/production-environment.md
- docs/production-smoke-test.md
- docs/attachments.md
- docs/backup-recovery.md
