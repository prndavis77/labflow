# LabFlow Production Smoke Test

Last verified: 2026-08-03

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

## Backend health

- [x] Production health endpoint returns HTTP 200
- [x] Health endpoint returns JSON
- [x] Database connection succeeds
- [x] Health response does not expose credentials
- [x] Health response does not expose internal stack traces
- [x] Backend returns security-related response headers

Health endpoint:

```text
https://labflow-backend-p7im.onrender.com/api/health
```

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

Test Suites: 28 passed, 28 total
Tests: 452 passed, 452 total
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

## Open items

- Kaspersky reanalysis is pending.
- Production invitation resend has not been manually verified.
- External uptime monitoring has not yet been configured.
- Production readiness and dependency health endpoints have not yet been separated.
- Backup restoration has not yet been manually tested.
- Password reset and email verification are not yet implemented.
- Production-grade monitoring and centralized logging are not yet implemented.

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
