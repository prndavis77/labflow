# LabFlow Production Smoke Test

Last verified: 2026-08-08

## Purpose

This checklist verifies that the deployed LabFlow frontend, backend, database, email service, object storage, authentication workflows, and organization-isolation controls are operating correctly.

The production smoke test must use synthetic or non-sensitive test data only.

## Deployment

- [x] Intended backend commit deployed to Render
- [x] Intended frontend commit deployed to Vercel
- [x] Render deployment completed successfully
- [x] Vercel deployment completed successfully
- [x] Backend starts without missing environment-variable errors
- [x] Production database migrations completed successfully
- [x] Temporary local production database environment variables were cleared
- [ ] Kaspersky reanalysis completed

### Current access limitation

Kaspersky currently classifies the generated Vercel hostname as phishing and may block the frontend JavaScript and CSS assets.

A reanalysis request has been submitted. The application currently requires temporary local protection pausing on the affected test system during initial loading. Users must not be instructed to disable or pause antivirus protection as a normal access procedure.

## Production environment

### Frontend

Provider: Vercel

Verified variables:

- `VITE_API_URL`

The frontend contains no database, JWT, Mailgun, or Cloudflare R2 secret credentials.

### Backend

Provider: Render

Verified configuration areas:

- Production runtime environment
- PostgreSQL connection
- JWT authentication
- Frontend origin
- Mailgun email delivery
- Cloudflare R2 attachment storage

Render does not require a manually configured `PORT` environment variable for the current deployment. The service uses the runtime port supplied by Render.

Secret values are stored only in the hosting environment and are not recorded in this document.

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
https://labflow-backend-p7im.onrender.com/api/health
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
https://labflow-backend-p7im.onrender.com/api/ready
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
- [x] Application uses the deployed Render API
- [x] No requests are sent to a localhost backend
- [x] JavaScript and CSS assets load when not interrupted by Kaspersky
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
- [x] Cloudflare R2 accepts the CORS preflight request
- [x] Direct browser-to-R2 upload succeeds
- [x] Backend completion verification succeeds
- [x] Attachment becomes available in LabFlow

The production R2 bucket CORS policy permits the deployed Vercel frontend and the local Vite development origin.

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
- [x] Restoration verifies that the R2 object exists
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

- Kaspersky reanalysis is pending.
- Production invitation resend has not been manually verified.
- Backup restoration has not yet been manually tested.
- Additional security hardening remains planned.
- Automated frontend/E2E testing remains planned.
- Privacy, data-lifecycle, and tenant-administration hardening remains planned.

## Current result

The deployed LabFlow MVP has passed production verification for:

- Backend health
- Frontend-to-backend connectivity
- Database migrations
- Workspace registration
- Invitation email delivery
- Invitation acceptance
- Session clearing after invitation acceptance
- Organization-isolated dashboard and resource access
- Direct Cloudflare R2 attachment upload
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

The following items remain outside the scope of Phase 24A.9 and are carried forward:

- Kaspersky reanalysis
- Manual production verification of invitation resend
- External uptime monitoring
- Separate readiness and dependency-health checks
- Backup restoration testing
- Password reset and email verification
- Centralized logging and production monitoring

## Phase 24A Completion Decision

Phase 24A is complete with documented carry-forward items.

The deployed LabFlow application has been verified across its primary production dependencies and critical workflows:

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

The following items do not block completion of Phase 24A and are carried forward:

- Kaspersky hostname reanalysis, which depends on an external reputation-service decision
- Manual production verification of invitation resend
- External uptime monitoring
- Separate liveness and readiness endpoints
- Backup restoration testing
- Centralized production logging and alerting

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

Phase 25A improves observability and operational reliability. It does not by itself make LabFlow ready for sensitive, regulated, or institutional production data.

The next production-hardening area is backup, restore, and disaster recovery.
