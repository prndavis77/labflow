# Labfluss Production Runbook

## Purpose

This runbook describes how to diagnose and respond to operational problems in the deployed Labfluss application.

It is intended for the current Labfluss production/demo environment.

Labfluss is currently suitable for portfolio demonstrations, controlled pilot demonstrations, invited testers, and non-sensitive test data. This runbook does not imply readiness for regulated or sensitive research data.

## Production Services

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachment storage: Cloudflare R2
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

## External Monitoring

Better Stack monitors:

1. Labfluss frontend
2. Backend liveness
3. Backend readiness

Email alert delivery has been manually verified.

The readiness monitor should be treated as the primary backend availability signal because it detects both backend outages and database connectivity failures.

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
2. Lightsail backend logs for database errors.
3. `DATABASE_URL` configuration.
4. Recent database or deployment changes.
5. Whether the Lightsail-to-RDS private connection is reachable.
6. Whether the failure is temporary or persistent.

Do not weaken TLS/SSL validation merely to suppress connection warnings.

### Frontend up, readiness up, application feature failing

Likely area:

- application/controller error
- authorization
- external dependency such as R2 or Mailgun
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
- R2 credentials
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
3. Check Cloudflare R2 availability and credentials.
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

Before production migrations:

1. Connect to the authorized Lightsail backend host.
2. Change to `/opt/labflow/labflow-backend`.
3. Confirm the intended migration files.
4. Check migration status.
5. Apply migrations intentionally using the production environment configuration.
6. Check migration status again.

Do not copy the production `DATABASE_URL` to an unrelated local machine merely to run migrations.

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
- independent dated Cloudflare R2 attachment backups
- SHA-256 attachment-integrity verification
- successfully tested representative R2 object recovery
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

## Better Stack Alert Response

When an alert arrives:

1. Identify the failed monitor.
2. Compare the three permanent monitor states.
3. Use the health/readiness matrix in this runbook.
4. Check AWS Lightsail or AWS Amplify depending on the failure pattern.
5. Use structured logs and request IDs for backend failures.
6. Acknowledge the incident after investigation begins.
7. Confirm recovery in Better Stack after the underlying service recovers.

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

Remaining pre-pilot hardening includes automated frontend/E2E testing, automated and off-provider attachment backups, transactional-email production cleanup, and final customer/compliance readiness work.

## Related Documentation

- docs/production-deployment.md
- docs/production-environment.md
- docs/production-smoke-test.md
- docs/attachments.md
- docs/backup-recovery.md
