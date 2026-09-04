# Labfluss Production Smoke Test

Last verified: 2026-09-01

Attachment storage migrated from Cloudflare R2 to Amazon S3 during Phase 26C.4 on 2026-09-04. Storage-specific production verification was performed as part of that migration. A full end-to-end production smoke-test rerun remains scheduled for Phase 26C.10.

## Purpose

This checklist verifies that the deployed Labfluss frontend, backend, database, email service, object storage, authentication workflows, and organization-isolation controls are operating correctly.

The production smoke test must use synthetic or non-sensitive test data only.

## Deployment

- [x] Intended backend commit deployed to AWS Lightsail
- [x] Intended frontend commit deployed to AWS Amplify Hosting
- [x] Lightsail backend service started successfully
- [x] Amplify frontend deployment completed successfully
- [x] Production custom frontend domain is available at `https://app.labfluss.com`
- [x] Production API domain is available at `https://api.labfluss.com`
- [x] Backend starts without missing environment-variable errors
- [x] Production database migrations completed successfully
- [x] Amazon RDS production database is private-only
- [x] Lightsail-to-RDS private connectivity verified
- [x] Backend liveness and readiness endpoints return HTTP 200
- [x] Attachment-cleanup systemd timer is enabled and active

### Historical frontend reputation issue

During the earlier Vercel-hosted deployment, Kaspersky classified the generated Vercel hostname as phishing and could block frontend JavaScript and CSS assets.

This issue affected the former generated Vercel hostname rather than the current AWS Amplify deployment. The production frontend is now served from:

```text
https://app.labfluss.com
```

Users should never be instructed to disable or pause antivirus protection as a normal access procedure.

## Production environment

### Frontend

Provider: AWS Amplify Hosting

Verified variables:

- `VITE_API_URL`

Production frontend origin:

- `https://app.labfluss.com`

Production API target:

- `https://api.labfluss.com/api`

The frontend contains no database, JWT, Mailgun, or AWS/S3 secret credentials.

### Backend

Provider: AWS Lightsail

Verified configuration areas:

- Production runtime environment
- PostgreSQL connection
- JWT authentication
- Frontend origin
- Mailgun email delivery
- Amazon S3 attachment storage

The backend application listens on port 5000. Nginx proxies public HTTPS API traffic to `127.0.0.1:5000`.

The production backend is supervised by `labflow-backend.service` under systemd.

Production backend origin:

- `https://api.labfluss.com`

Backend path:

- `/opt/labflow/labflow-backend`

Environment file:

- `/opt/labflow/labflow-backend/.env`

Secret values are stored only in the hosting environment and are not recorded in this document.

### Database

Provider: Amazon RDS for PostgreSQL

Verified production configuration:

- DB instance: `labflow-production`
- Database: `labflow`
- PostgreSQL: 17.11
- Region: `eu-central-1`
- Deployment: Single-AZ
- Publicly accessible: No
- Automated backup retention: 7 days
- Lightsail-to-RDS private connectivity: verified

## Backend health and readiness

### Liveness

- [x] Production liveness endpoint returns HTTP 200
- [x] Liveness endpoint returns JSON
- [x] Liveness endpoint remains independent of PostgreSQL availability
- [x] Health response does not expose credentials
- [x] Health response does not expose internal stack traces
- [x] Backend returns security-related response headers

Liveness endpoint:

```text
https://api.labfluss.com/api/health
```

### Readiness

- [x] Production readiness endpoint returns HTTP 200 while PostgreSQL is reachable
- [x] Readiness response reports the database as ready
- [x] Readiness performs an active PostgreSQL connectivity check
- [x] Database-unavailable behavior returns HTTP 503 in automated readiness tests
- [x] Readiness failure response includes a request ID in automated readiness tests
- [x] Readiness failure response does not expose database internals in automated readiness tests

Readiness endpoint:

```text
https://api.labfluss.com/api/ready
```

## Observability and operational monitoring

### Structured backend logging

- [x] Production backend logs use structured JSON
- [x] Development logs remain human-readable
- [x] Request correlation IDs are generated for API requests
- [x] `X-Request-ID` is returned to clients
- [x] HTTP completion logs include method, sanitized path, status, duration, and request ID
- [x] Authenticated request logs can include user and organization IDs
- [x] Sensitive token-bearing URL paths are sanitized before logging
- [x] Passwords, tokens, authorization headers, cookies, credentials, and signed URLs are redacted or intentionally excluded

### Centralized error visibility

- [x] Unexpected request errors are captured by the global error handler
- [x] Production 500 responses return a safe generic message
- [x] Production 500 responses include a request ID
- [x] Controller and service failures use structured application events
- [x] Client responses do not expose internal stack traces, SQL, storage internals, or provider details

### Email-delivery visibility

- [x] Successful provider delivery is logged as `email_delivery_succeeded`
- [x] Disabled/skipped delivery is logged as `email_delivery_skipped`
- [x] Provider failures are logged as `email_delivery_failed`
- [x] Email observability does not intentionally log recipient addresses, subjects, bodies, sensitive links, or provider message IDs

### Attachment-cleanup visibility

- [x] Individual cleanup failures are logged as `attachment_cleanup_item_failed`
- [x] Rollback failures are logged separately as `attachment_cleanup_rollback_failed`
- [x] Cleanup failure logs do not intentionally expose storage keys

### Attachment-cleanup scheduler

- [x] `labflow-attachment-cleanup.service` exists on the Lightsail host
- [x] `labflow-attachment-cleanup.timer` exists on the Lightsail host
- [x] Timer is enabled
- [x] Timer is active and waiting
- [x] Next timer invocation is scheduled
- [x] Manual cleanup execution completed successfully
- [x] Verified cleanup run processed 2 expired items with 0 failures

### External uptime monitoring

- [x] Better Stack frontend monitor configured
- [x] Better Stack backend liveness monitor configured
- [x] Better Stack backend readiness monitor configured
- [x] All three permanent monitors verified Up
- [x] Email alert delivery verified using a Better Stack test incident
- [x] Email alert delivery verified using a deliberately invalid temporary HTTP monitor
- [x] Temporary failure-test monitor removed after verification

## Frontend

- [x] Login page loads
- [x] Registration page loads
- [x] Application uses the deployed AWS Lightsail API at `https://api.labfluss.com`
- [x] No requests are sent to a localhost backend
- [x] JavaScript and CSS assets load successfully from the AWS Amplify frontend
- [x] Authenticated navigation works
- [x] Protected routes require authentication

## Workspace registration

- [x] New organization workspace can be created
- [x] First workspace user becomes an administrator
- [x] New organization receives a unique organization identity
- [x] New organization contains no demo projects
- [x] New organization contains no demo tasks
- [x] New organization contains no demo experiments
- [x] New organization contains no demo protocols
- [x] New organization contains no demo equipment
- [x] New organization contains no demo bookings
- [x] New organization contains no demo review items

## Account security

### Email verification

- [x] New workspace administrator receives a verification email
- [x] Unverified users are restricted from protected workspace functionality
- [x] Verification email can be resent
- [x] Verification link opens the deployed frontend flow
- [x] Email verification succeeds
- [x] Verified user regains protected workspace access
- [x] Invited accounts are treated as verified
- [x] Raw verification tokens are not exposed in production logs

### Password reset

- [x] Password-reset request returns a generic response
- [x] Password-reset email arrives in production
- [x] Reset link opens the deployed frontend route
- [x] Reset token validates successfully
- [x] Password reset succeeds
- [x] Used reset link cannot be reused
- [x] Old password is rejected after reset
- [x] New password is accepted
- [x] Raw password-reset tokens are not exposed in production logs

### Session invalidation

- [x] Password reset invalidates previously issued JWT sessions
- [x] Stale JWT returns `401 SESSION_INVALIDATED`
- [x] Frontend clears the stale token
- [x] Frontend redirects to login
- [x] Session-invalidated notice is shown once
- [x] Fresh login after password reset succeeds

## Invitation onboarding

- [x] Administrator can create an invitation
- [x] Invitation request succeeds
- [x] Invitation appears in the administrator invitation list
- [x] Delivery status updates
- [x] Production invitation email arrives
- [x] Production API does not expose the raw invitation link
- [x] Production API does not expose the provider message ID
- [x] Invitation details load from the emailed link
- [x] Organization name is correct
- [x] Invited email address is correct
- [x] Invited user can set a password
- [x] Account is created inside the correct organization
- [x] Invitation is marked as accepted
- [x] Accepted invitation link cannot be reused
- [x] Existing browser session is cleared after acceptance
- [x] Invited email is prefilled on the login page
- [x] Invited user can log in
- [x] Invited user sees only their organization’s data
- [ ] Production invitation resend verified

Production invitation creation and acceptance were verified using three test invitations.

The backend resend workflow is implemented and covered by automated tests, but it has not yet been manually verified in production.

## Organization isolation

### Demo organization

- [x] Demo administrator sees demo dashboard data
- [x] Demo projects are present
- [x] Demo equipment is present
- [x] Demo review items are present

### New organization

- [x] Dashboard metrics are zero
- [x] Dashboard lists are empty
- [x] Projects are empty
- [x] Tasks are empty
- [x] Experiments are empty
- [x] Protocols are empty
- [x] Equipment is empty
- [x] Bookings are empty
- [x] Review Queue is empty
- [x] Archived Items is empty
- [x] Audit Logs contain only the organization’s own events
- [x] Invitation list contains only the organization’s own invitations
- [x] `/api/dashboard/summary` contains no demo-organization records

## Attachments

### Upload

- [x] Browser can request a signed upload URL
- [x] Amazon S3 accepts the CORS preflight request
- [x] Direct browser-to-S3 upload succeeds
- [x] Backend completion verification succeeds
- [x] Attachment becomes available in Labfluss

The production S3 bucket CORS policy permits the deployed AWS Amplify frontend and the local Vite development origin.

### Download

- [x] Download succeeds
- [x] Downloaded filename is correct
- [x] Downloaded file contents are unchanged
- [x] Response uses `Content-Disposition: attachment`
- [x] Response uses the expected content type
- [x] Signed download URL expires after 60 seconds
- [x] Expired URL returns `ExpiredRequest`

### Metadata and lifecycle

- [x] Attachment metadata can be edited
- [x] Metadata changes persist after refresh
- [x] Attachment can be archived
- [x] Archived attachment disappears from active views
- [x] Archived attachment appears under Archived Items
- [x] Archived Items displays the correct filename
- [x] Archived Items displays the correct archive timestamp
- [x] Archived Items displays the correct linked record
- [x] Attachment restoration succeeds
- [x] Restoration verifies that the S3 object exists
- [x] Restored attachment returns to the active list
- [x] Restored attachment can be downloaded
- [x] Restored file contents remain unchanged

## Automated regression tests

Backend test result:

Test Suites: 36 passed, 36 total
Tests: 525 passed, 525 total
Snapshots: 0 total

Verified coverage includes:

- Authentication
- Authorization
- Organization isolation
- Dashboard organization isolation
- Invitation onboarding
- Invitation email delivery
- Invitation resend
- Invitation token invalidation
- Workspace registration
- Equipment booking conflicts
- Review workflows
- Audit logs
- Attachment access
- Attachment uploads and downloads
- Attachment archive and recovery
- Transactional rollback behavior
- Password reset
- Email verification
- JWT session invalidation
- Structured request logging
- Centralized error handling
- Liveness and database readiness
- Email-delivery observability
- Attachment-cleanup failure observability

## Open items

- Production invitation resend has not yet been manually re-verified after the AWS migration.
- Automated frontend/E2E testing remains planned.
- Automated daily attachment backup remains to be implemented.
- Off-machine or off-provider attachment backup remains to be implemented.
- Mailgun remains the current transactional-email provider pending the planned email-infrastructure migration.
- Further institutional tenant-administration capabilities remain future work.

## Current result

The deployed Labfluss application has passed production verification for:

- Backend health
- Frontend-to-backend connectivity
- Database migrations
- Workspace registration
- Invitation email delivery
- Invitation acceptance
- Session clearing after invitation acceptance
- Organization-isolated dashboard and resource access
- Direct Amazon S3 attachment upload
- Signed attachment download and expiration
- Attachment metadata editing
- Attachment archive and restoration
- Production password reset
- Production email verification
- JWT session invalidation after password reset
- Structured production logging
- Request correlation IDs
- Centralized error capture
- Separate backend liveness and PostgreSQL-aware readiness
- Email-delivery failure visibility
- Attachment-cleanup failure visibility
- Better Stack external uptime monitoring
- Verified Better Stack email alert delivery
- AWS Amplify production frontend
- AWS Lightsail production backend
- Amazon RDS PostgreSQL production database
- Private Lightsail-to-RDS connectivity
- HTTPS on `app.labfluss.com` and `api.labfluss.com`
- systemd backend supervision
- systemd attachment-cleanup scheduling

## Phase 24A.9 Completion

Phase 24A.9 is complete.

The production smoke-test baseline now documents:

- Deployment verification
- Backend health
- Frontend connectivity
- Workspace registration
- Invitation onboarding
- Organization isolation
- Cloudflare R2 upload and download behavior
- Signed URL expiration
- Attachment metadata, archive, and restoration
- Automated backend regression results
- Known production limitations and open operational items

The following items were outside the scope of Phase 24A.9 and were carried forward at that time:

This list reflects the unresolved items at the time Phase 24A.9 was completed and is retained for historical traceability.

- Kaspersky reanalysis
- Manual production verification of invitation resend
- External uptime monitoring
- Separate readiness and dependency-health checks
- Backup restoration testing
- Password reset and email verification
- Centralized logging and production monitoring

## Phase 24A Completion Decision

This section is a historical record of the production state verified during Phase 24A. The application was later migrated to AWS during Phase 26C.

Phase 24A is complete with documented carry-forward items.

The deployed Labfluss application has been verified across its primary production dependencies and critical workflows:

- Vercel frontend deployment
- Render backend deployment
- Neon PostgreSQL connectivity and migrations
- Mailgun invitation creation and delivery
- Invitation acceptance and organization assignment
- Organization-scoped dashboard and resource access
- Cloudflare R2 direct uploads
- Signed downloads and URL expiration
- Attachment metadata, archive, and restoration
- Backend health and automated regression testing

The following items were still outstanding at the time Phase 24A was completed. Several were completed in later production-hardening phases.

- External uptime monitoring
- Separate liveness and readiness endpoints
- Backup restoration testing
- Password reset and email verification
- Centralized logging and production monitoring

Phase 24A establishes a verified production deployment baseline. It does not represent full production readiness for sensitive or regulated research data.

## Phase 25A Observability and Operational Reliability

Phase 25A adds the operational visibility required to diagnose production failures more reliably.

Completed capabilities include:

- structured production logging
- readable development logging
- request correlation IDs
- sanitized request-path logging
- centralized backend error capture
- safe production 500 responses
- database-independent liveness checks
- PostgreSQL-aware readiness checks
- centralized email-delivery visibility
- attachment-cleanup failure visibility
- external Better Stack monitoring
- verified email incident alerts
- a documented production incident-response runbook

The current automated backend regression baseline is:

```text
Test Suites: 36 passed, 36 total
Tests: 525 passed, 525 total
Snapshots: 0 total
```

Phase 25A improves observability and operational reliability. It does not by itself make Labfluss ready for sensitive, regulated, or institutional production data.

At the completion of Phase 25A, the next production-hardening area was backup, restore, and disaster recovery. That work was subsequently addressed in Phase 25B.
