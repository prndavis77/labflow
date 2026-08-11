# LabFlow Production Runbook

## Purpose

This runbook describes how to diagnose and respond to operational problems in the deployed LabFlow application.

It is intended for the current LabFlow production/demo environment.

LabFlow is currently suitable for portfolio demonstrations, controlled pilot demonstrations, invited testers, and non-sensitive test data. This runbook does not imply readiness for regulated or sensitive research data.

## Production Services

- Frontend: Vercel
- Backend: Render
- Database: Neon PostgreSQL
- Attachment storage: Cloudflare R2
- Transactional email: Mailgun
- External uptime monitoring: Better Stack

## Production URLs

Frontend:

```text
https://labflow-brown.vercel.app
```

Backend liveness:

https://labflow-backend-p7im.onrender.com/api/health

Backend readiness:

https://labflow-backend-p7im.onrender.com/api/ready

## Health Model

LabFlow uses separate liveness and readiness checks.

### Liveness

`GET /api/health`

Expected response:

```json
{
  "status": "success",
  "message": "Labflow API is running"
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
  "message": "LabFlow API is ready",
  "checks": {
    "database": "ready"
  }
}
```

A successful readiness response means the backend can currently communicate with PostgreSQL.

If PostgreSQL cannot be reached, readiness returns HTTP 503 with a safe response that does not expose database internals.

## External Monitoring

Better Stack monitors:

1. LabFlow frontend
2. Backend liveness
3. Backend readiness

Email alert delivery has been manually verified.

The readiness monitor should be treated as the primary backend availability signal because it detects both backend outages and database connectivity failures.

## Incident Triage

### Frontend down, health and readiness up

Likely area:

- Vercel deployment
- frontend asset delivery
- frontend routing
- frontend configuration

Check:

1. Vercel deployment status.
2. Browser network errors.
3. VITE_API_URL.
4. Recent frontend deployment.
5. Whether the backend URLs remain healthy.

### Health down and readiness down

Likely area:

- Render service unavailable
- backend crash
- deployment failure
- startup failure
- networking or hosting issue

Check:

1. Render service status.
2. Render deployment status.
3. Render application logs.
4. Backend startup logs.
5. Recent commits and deployments.
6. Missing or invalid production environment variables.

### Health up, readiness down

Likely area:

- PostgreSQL connectivity
- Neon availability
- database credentials
- SSL configuration
- connection exhaustion
- database networking

Check:

1. Neon project status.
2. Render logs for database errors.
3. DATABASE_URL configuration.
4. Recent database or deployment changes.
5. Whether the failure is temporary or persistent.

Do not weaken TLS/SSL validation merely to suppress connection warnings.

### Frontend up, readiness up, application feature failing

Likely area:

- application/controller error
- authorization
- external dependency such as R2 or Mailgun
- data-specific failure

Use the request correlation ID from the failed API request where available.

Search Render logs for the same requestId.

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

1. Check Render logs for email_delivery_failed.
2. Check the associated feature-specific event.
3. Check Mailgun status and configuration.
4. Verify the configured domain and sender.
5. Confirm MAILGUN_API_KEY, domain, and API base URL are present.
6. Do not expose reset, verification, or invitation tokens while troubleshooting.

## Attachment Cleanup Failures

Attachment cleanup failure events include:

attachment_cleanup_item_failed
attachment_cleanup_rollback_failed

A failed item should not prevent other cleanup candidates from being attempted.

If cleanup failures occur:

1. Check the attachment ID in structured log context.
2. Check database availability.
3. Check Cloudflare R2 availability and credentials.
4. Verify the object-storage configuration.
5. Do not log or expose the attachment storage key unnecessarily.
6. Do not expose signed URLs.

## HTTP 500 Investigation

When an API request returns HTTP 500:

1. Capture the response requestId if present.
2. Search Render logs for that request ID.
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

1. Confirm Render deployment succeeds.
2. Confirm Vercel deployment succeeds if frontend changed.
3. Check:
   `GET /api/health`
   `GET /api/ready`
4. Confirm Better Stack reports all permanent monitors as Up.
5. Check Render logs for startup or repeated error events.
6. Perform a basic login and application load.
7. Verify the changed production workflow when applicable.

## Production Database Safety

Never run tests against the production database.

Never run seed commands against production unless intentionally resetting demo data.

Before production migrations:

1. Confirm the intended migration files.
2. Check migration status.
3. Apply migrations intentionally.
4. Check migration status again.
5. Remove temporary local production environment variables immediately afterward.

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

- Neon PostgreSQL point-in-time recovery with a current 6-hour history window
- one manually maintained Neon recovery snapshot
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

Never point Jest or integration tests at the production Neon database.

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
4. Check Render or Vercel depending on the failure pattern.
5. Use structured logs and request IDs for backend failures.
6. Acknowledge the incident after investigation begins.
7. Confirm recovery in Better Stack after the underlying service recovers.

## Current Monitoring Interpretation

| Frontend | Health | Readiness | Likely interpretation                     |
| -------- | ------ | --------- | ----------------------------------------- |
| Up       | Up     | Up        | Core platform available                   |
| Down     | Up     | Up        | Frontend/Vercel issue                     |
| Up       | Up     | Down      | Database/dependency issue                 |
| Up       | Down   | Down      | Backend/Render issue                      |
| Down     | Down   | Down      | Broad deployment or infrastructure outage |

## Known Operational Boundaries

The current LabFlow deployment is not yet intended for:

- regulated laboratory records
- sensitive research data
- institutional production workloads
- guaranteed uptime/SLA workloads

Backup and recovery hardening has been completed for the current demo/pilot stage, including an isolated PostgreSQL restore drill and attachment-recovery reconciliation.

Remaining hardening phases cover security, automated frontend/E2E testing, and privacy/data lifecycle controls.

## Related Documentation

- docs/production-deployment.md
- docs/production-environment.md
- docs/production-smoke-test.md
- docs/attachments.md
- docs/backup-recovery.md
