# LabFlow Case Study

## Overview

LabFlow is a full-stack project management application for university research laboratories. It helps lab teams manage research projects, tasks, experiments, protocols, shared equipment, equipment bookings, review workflows, notebook entries, and project-specific access control in one centralized system.

The project was built as a portfolio/demo application to demonstrate practical full-stack development in a real-world scientific workflow domain.

## Live Demo

Live demo:

```txt
https://labflow-brown.vercel.app
```

Backend health check:

```txt
https://labflow-backend-p7im.onrender.com/api/health
```

GitHub repository:

```txt
https://github.com/prndavis77/labflow
```

The deployed demo uses Vercel for the React/Vite frontend, Render for the Node/Express backend API, and Neon PostgreSQL for the hosted PostgreSQL database.

The live demo uses seeded test data and shared demo accounts. It should not be used with real laboratory, research, customer, or institutional data.

## Problem

University research labs often manage daily work across disconnected tools:

- Spreadsheets for project tracking, samples, tasks, and schedules
- Email or informal messages for supervisor feedback
- Shared drives for protocols and reports
- Calendar apps for shared equipment bookings
- Paper or digital notebooks for experiment notes

This can make basic lab management questions harder to answer:

- Which projects are active?
- Which tasks are overdue?
- Which experiments need review?
- Which protocols are approved?
- Which equipment is currently booked?
- Are two researchers trying to book the same instrument at the same time?
- What feedback did a supervisor leave on a rejected experiment or protocol?

LabFlow was designed to bring these related workflows into one structured application.

## Solution

LabFlow centralizes core research lab workflows into one system:

- Project management
- Standalone and project-linked task management
- Experiment tracking
- Experiment-linked notebook entries
- Protocol and SOP management
- Equipment inventory
- Equipment booking with conflict prevention
- Secure research file attachments for projects, tasks, experiments, protocols, and equipment
- Review queue for supervisor/admin workflows
- Required review notes for change requests
- Review history tracking
- Role-aware dashboard metrics
- Admin user management
- Configurable researcher workflow permissions and review requirements
- Bulk researcher permission and review-policy controls
- Project membership and project-specific access rules
- Public organization workspace creation
- First-administrator onboarding
- Invitation-only onboarding for additional users
- Mailgun-backed invitation email delivery implemented and verified locally
- Delivery status tracking and provider diagnostics
- Admin-only backend invitation resend with token rotation and renewed expiration
- Safe partial-failure behavior when email delivery is unavailable
- Session clearing and login handoff after invitation acceptance
- Secure invitation token hashing and one-time acceptance
- Self-service password reset with 30-minute token expiry
- Email verification with 24-hour token expiry and resend support
- Restricted workspace access for unverified accounts
- JWT `tokenVersion` invalidation after password changes
- Automatic frontend logout and one-time notice for invalidated sessions
- Organization-scoped demo seed behavior

The result is a working MVP that models how research work, supervision, review, and shared equipment usage can fit together in a single full-stack web application.

## My Role

I designed and built the full-stack MVP, including:

- PostgreSQL database schema
- Sequelize models and associations
- Express REST API
- JWT authentication
- Role-based access control
- Project membership and project-scoped access rules
- React/Vite frontend
- Ant Design UI pages and forms
- Dashboard summary endpoint
- Review queue workflow
- Experiment-linked notebook workflow
- Equipment booking conflict prevention
- Admin user management workflow
- Researcher permission controls
- Reusable experiment and protocol form modals
- Demo seed data
- Sequelize migrations
- Backend automated tests with Jest and Supertest
- Deployment to Vercel, Render, and Neon PostgreSQL
- Organization settings workflow
- Invitation list management
- Workspace registration and first-admin onboarding
- Unique organization slug generation
- Transactional registration and invitation acceptance
- Multi-organization-safe demo seed behavior
- Private Cloudflare R2 attachment architecture
- Direct signed upload and download workflow
- Cross-entity attachment authorization and reusable frontend components
- Self-service password-reset architecture and frontend flow
- Email-verification workflow and unverified-account restrictions
- JWT `tokenVersion` session invalidation
- Frontend stale-session handling and login redirect
- Password-reset and email-verification email templates
- Account-security automated and manual regression testing

## Tech Stack

### Frontend

- React
- Vite
- Ant Design
- React Router
- Axios
- Day.js

### Backend

- Node.js
- Express
- PostgreSQL
- Sequelize
- Sequelize CLI
- JWT
- bcrypt
- Helmet
- express-rate-limit
- cors
- dotenv
- mailgun.js
- form-data
- Cloudflare R2
- AWS SDK for JavaScript S3 client and URL presigning

### Testing and Deployment

- Jest
- Supertest
- Vercel
- Render
- Neon PostgreSQL
- Git and GitHub

## Key Technical Features

### Relational Database Design

LabFlow uses a relational PostgreSQL schema modeled with Sequelize. The main entities include users, projects, project members, tasks, experiments, protocols, equipment, equipment bookings, notebook entries, review events, and attachments.

The data model is designed around connected lab workflows. Projects can have tasks, experiments, protocols, bookings, notebook entries, and project members. Experiments can link to projects, researchers, tasks, protocols, bookings, and notebook entries. Equipment can link to bookings and instrument-specific SOPs.

### Authentication and Authorization

The app uses JWT authentication with protected frontend routes and protected backend API routes.

LabFlow supports three main user roles:

- Admin
- Supervisor
- Researcher

Admins have global access across the demo workspace. Supervisors are scoped to projects where they are assigned as the project supervisor. Researchers access project-linked work through project membership and assignment-aware task rules. Researchers can also view organization-wide equipment and general protocols that are not linked to a project. Access to project-linked protocols remains membership-aware.

The backend enforces authorization rules so users cannot bypass access restrictions by calling API endpoints directly.

### Project Membership and Layered Permissions

LabFlow uses a layered permission model:

- System role: admin, supervisor, or researcher
- Project role: lead, member, or viewer
- Researcher workflow permissions: create/edit experiments and protocols

This avoids giving researchers broad access just because they have a general permission flag. For example, a researcher may have permission to create protocols, but they can only create project-linked protocols for projects where they are a member and where their project role allows contribution.

Project viewers have read-only access to project-linked work. Project members can contribute when their workflow permissions allow it. Project leads can coordinate project-linked work.

### Researcher Workflow Permissions and Review Policy

Admins can configure whether each researcher can:

- Create experiments
- Edit experiments
- Create protocols
- Edit protocols
- Work under mandatory experiment and protocol review

The admin user management page supports both individual switches and bulk controls that update all researcher accounts. Bulk controls are available for experiment permissions, protocol permissions, and the review requirement.

Researchers who require review create experiments and protocols with a review status of `not_submitted`. Researchers who are exempt create them with `not_required`, so the system can distinguish independent work from supervisor-approved work without falsely marking exempt records as approved.

This supports different lab supervision styles. Some labs may require formal review for every experiment and method, while others may allow experienced researchers to work independently and request help only when needed.

The frontend communicates the configured policy, while the backend remains the enforcement point.

### Locked Project Linkage

Tasks, experiments, and protocols can be linked to projects. Once a project link is assigned during creation, the normal edit workflow locks that project link.

This prevents a researcher from accidentally moving a record to a project they cannot access, which could cause them to lose the ability to correct the mistake. Project reassignment is treated as a future admin-level workflow rather than a normal edit action.

### Standalone and Project-Linked Tasks

Lab work is not always tied to a research project. A researcher may be assigned to restock supplies, tune an instrument, change a column, clean equipment, or assist another researcher.

LabFlow supports both project-linked tasks and standalone lab tasks. Researcher task visibility is assignment-aware, so researchers can see tasks assigned to them even when those tasks are not linked to a project.

### Task Completion Review

Researchers do not directly mark assigned tasks as done. Instead, they can submit a completion request. This changes the task status to Completion Requested.

Admins can confirm or reopen any task completion request. Supervisors can confirm or reopen project-linked task completion requests only for projects they supervise. Standalone task completion review is reserved for admins.

This workflow better reflects supervised lab work, where task completion may need review before it is accepted as final.

### Invitation Email Delivery and Resend

LabFlow includes a provider-neutral email service with a Mailgun implementation. Mailgun delivery has been verified locally.

The invitation creation workflow intentionally separates database persistence from the external provider call:

1. Validate the invitation request.
2. Create the invitation and audit event.
3. Commit the database transaction.
4. Attempt email delivery.
5. Persist the delivery result.

This ordering prevents a temporary Mailgun failure from deleting or rolling back a valid invitation. The API can return a successful invitation-creation response with a partial-delivery warning, and the backend provides an admin-only resend operation.

Delivery tracking records:

- Delivery status: not attempted, sent, failed, or skipped
- Provider
- Provider message ID
- Last delivery-attempt time
- Sent time

Provider message IDs are stored for diagnostics but are not exposed in API responses.

Resend is admin-only and organization-scoped. It creates a new raw token, stores only the new hash, renews the expiration date, invalidates the previous link, resets delivery tracking, writes an audit event, and attempts the replacement email. Pending and expired invitations can be resent. Accepted and revoked invitations cannot.

Production responses do not expose raw invitation links. Development and test responses can include them for local verification.

After invitation acceptance, the frontend clears any existing browser session before redirecting to login. This prevents a previously logged-in administrator session from remaining active when the invited researcher finishes onboarding. The invited email is prefilled on the login page.

### Password Reset, Email Verification, and Session Invalidation

LabFlow now includes self-service account recovery and verified-email enforcement.

Password-reset and email-verification links use random raw tokens, while PostgreSQL stores only SHA-256 hashes. Reset links expire after 30 minutes, and verification links expire after 24 hours. Requesting another verification email replaces earlier unused verification tokens. A successful password reset consumes the reset token and invalidates existing JWT sessions through `tokenVersion`.

Public workspace registration creates an unverified first administrator. The authenticated user can view the current account and request another verification email, but normal workspace APIs return `403 EMAIL_VERIFICATION_REQUIRED` until verification succeeds. Invitation-created users are marked verified during successful invitation acceptance.

JWTs contain the user’s current `tokenVersion`. Self-service and administrator password resets increment the database version. Any previously issued JWT then returns `401 SESSION_INVALIDATED`. The React frontend removes the stored token, clears authentication state, redirects to login, and displays a one-time message.

This design allows email verification to take effect immediately without issuing a replacement JWT, while password changes invalidate all older sessions.

### Equipment Booking Conflict Prevention

LabFlow prevents overlapping confirmed bookings for the same equipment at the backend level.

The conflict rule is:

```txt
existing.startTime < newEndTime
AND
existing.endTime > newStartTime
```

This means:

- 09:00 to 11:00 conflicts with 10:00 to 12:00
- 09:00 to 11:00 does not conflict with 11:00 to 12:00
- Cancelled bookings do not block new confirmed bookings

Because this logic is enforced on the backend, the rule does not depend only on frontend validation.

### Protocols and Equipment-Specific SOPs

Protocols can be linked to a project, linked to equipment, linked to both, or saved as general lab SOPs.

This allows LabFlow to support:

- Project-specific methods
- General lab SOPs
- Equipment-specific procedures
- Instrument startup, shutdown, tuning, and maintenance instructions

Researchers can view general non-project-linked protocols and project-linked protocols they are authorized to access. Creation, editing, review, and archive actions for general SOPs remain restricted to admins and supervisors.

### Review Queue, Review Notes, and Review History

LabFlow includes a Review Queue for supervisor/admin review workflows. Experiments, protocols, and task completion requests can be surfaced for review.

When requesting changes on an experiment or protocol, reviewers must provide a review note. The latest review comment is shown on the record so researchers can see what needs to be corrected, clarified, repeated, or improved.

LabFlow also stores review history events. This preserves repeated review cycles such as changes requested, revised, more changes requested, and approved.

### Experiment-Linked Notebook Entries

Experiments include notebook entries for procedures, observations, results, issues, conclusions, supervisor comments, and general notes.

Notebook entries are linked to experiments and projects, allowing experiment detail pages, project detail pages, and the dashboard to show recent research activity.

### Secure Research File Attachments

LabFlow includes a generic attachment system for projects, tasks, experiments, protocols, and equipment.

File metadata is stored in PostgreSQL, while file content is stored in a private Cloudflare R2 bucket. The backend creates short-lived signed upload URLs so files can be uploaded directly from the browser without passing the file body through the Express server.

The upload workflow has three stages:

1. LabFlow validates the target record, user permissions, filename, MIME type, extension, and file size.
2. The frontend uploads the file directly to private object storage using a signed URL.
3. LabFlow verifies the stored object before marking the attachment as available.

Downloads also use short-lived signed URLs. The backend verifies that the user can access the linked record before creating a download URL.

Attachment permissions follow the parent record:

- Admins have organization-wide attachment access.
- Supervisors are restricted by project, task, protocol, or equipment rules.
- Researchers can upload only where the linked workflow allows contribution.
- Researchers can edit or archive only files they uploaded.
- Read-only users can view and download but cannot upload or manage files.

The same reusable frontend components are used across project, task, experiment, protocol, and equipment detail pages. Cross-entity tests verify consistent behavior for view, upload, metadata update, archive, and download access.

### Admin-Controlled Archived Item Recovery

LabFlow supports controlled recovery of archived projects, tasks, experiments, protocols, and attachments.

Rather than adding separate recovery pages for each workflow, I created one admin-only Archived Items page with tabs for each supported entity type. The page provides search, archive-date filters, pagination, archive metadata, and restore actions.

Recovery is organization-scoped. An administrator can only list or restore records belonging to the administrator's current organization.

Restoration uses parent-first validation:

- A project must be active before restoring one of its project-linked children.
- A task, experiment, or protocol must be active before restoring an attachment linked to that record.
- Where a child belongs to a project, that project must also be active.
- Standalone tasks and general protocols can be restored without a project.
- Restoring one record does not automatically restore related children, siblings, or attachments.

This non-cascading behavior makes restoration explicit and prevents an administrator from unintentionally reactivating an entire record hierarchy.

The restore operation preserves the record's existing business status. It clears only archive metadata such as `isArchived`, `archivedAt`, and `archivedById`.

Each successful restore creates an audit event in the same PostgreSQL transaction. If audit creation fails, the database restoration is rolled back. Repeated requests for an already-active record are idempotent and do not create duplicate audit events.

Attachment recovery includes an additional storage check. Before the database record is restored, LabFlow performs a metadata request against private Cloudflare R2 storage. If the object does not exist, the attachment remains archived. If storage is temporarily unavailable, the operation fails safely and can be retried later.

Because PostgreSQL and Cloudflare R2 do not participate in one distributed transaction, the R2 existence check and database update cannot be fully atomic. The implementation minimizes that limitation by verifying storage immediately before the transactional database restore and by never changing the R2 object during recovery.

### Role-Aware Dashboard

The dashboard uses a backend summary endpoint to calculate key metrics such as:

- Active projects
- Open tasks
- Overdue tasks
- Task completion requests
- Experiments needing review
- Pending protocols
- Equipment in use now
- Equipment offline
- Upcoming equipment bookings
- Recent notebook entries

Dashboard data is role-aware. Admins see global data. Supervisors see project-linked data for projects they supervise. Researchers see project-linked data for projects where they are members, while task summaries are assignment-aware.

Equipment inventory metrics are still global in the current MVP because equipment is not project-owned yet.

### Reusable Frontend Components

Experiment and protocol create/edit forms were refactored into reusable modal components.

This allows list pages and detail pages to share the same form logic. Users can create or edit records from list pages, and they can also edit records directly from detail pages without duplicating form code.

### Sequelize Migrations

LabFlow now uses Sequelize migrations to manage the database schema. The initial migration creates the current MVP schema, including users, projects, project memberships, tasks, experiments, protocols, equipment, equipment bookings, notebook entries, review events, enums, indexes, and foreign key relationships.

This is a stronger deployment path than relying on automatic schema sync for future database changes.

### Automated Backend Testing

The backend includes automated tests using Jest and Supertest.

The backend test suite includes comprehensive coverage for authentication, password reset, email verification, unverified-account restrictions, JWT session invalidation, authorization, organization isolation, invitation email configuration, templates, provider behavior, delivery tracking, resend, archive recovery, attachments, review workflows, and transactional rollback.

The tests cover authentication, role-based access, organization-scoped data isolation, audit logs, archive behavior, researcher review policy, workspace registration, organization slug generation, invitation onboarding, transactional rollback behavior, and organization settings.

- Health check
- Authentication
- Protected route behavior
- Role-based authorization
- Project membership-aware access
- Supervisor-scoped visibility
- Equipment booking conflict prevention
- Task completion review
- Experiment review workflow
- Protocol review workflow
- Admin updates to researcher review requirements
- Review-required and review-exempt experiment creation
- Review-required and review-exempt protocol creation
- Review history event creation
- Cross-organization isolation for projects, tasks, and audit logs
- Public organization workspace creation
- First-administrator account creation
- Organization slug normalization and uniqueness
- Rejection of unsupported public organization types
- Ignoring client-supplied registration roles and organization fields
- Global duplicate-email protection
- Invitation token reuse prevention
- Transaction rollback during failed invitation acceptance
- Invitation email configuration and provider selection
- HTML and plain-text invitation template generation
- Successful, failed, and skipped delivery tracking
- Provider failure without invitation loss
- Invitation resend authorization and organization isolation
- Old-token invalidation and new-token acceptance
- Accepted and revoked invitation resend restrictions
- Production-safe invite-link behavior

Additional account-security coverage includes:

- Password-reset token creation, validation, expiry, consumption, and delivery failure handling
- Email-verification token creation, resend, expiry, consumption, and secret-leak prevention
- Unverified-account API restrictions and allowed verification exceptions
- Legacy JWT compatibility while `tokenVersion` remains zero
- Stale JWT rejection after self-service and administrator password resets
- Fresh-login acceptance after password reset
- Exact `401 SESSION_INVALIDATED` backend responses for stale JWTs

The frontend stale-session flow was manually verified by invalidating a logged-in user’s token version, confirming automatic logout, token removal, redirect to login, and a one-time session-invalidated notice.

A test database safety guard prevents destructive test cleanup from running unless `NODE_ENV` is set to `test` and the configured database name contains `test`.

### Backend Security Hardening

The deployed demo backend includes basic security hardening:

- Security headers with Helmet
- Authentication route rate limiting
- Restricted CORS origins
- JWT authentication
- Password hashing with bcrypt
- Protected routes
- Role-based authorization
- Project-scoped backend access checks

The project is still a portfolio/demo application and would need additional production hardening before handling real users or real research data.

### Audit Logging

LabFlow includes an admin-only audit logging system for sensitive actions and review workflow events. The audit log records who performed the action, what entity was affected, the target user when relevant, a readable summary, request metadata, and timestamps.

Audit logging currently covers user role changes, workflow permission updates, account deactivation and reactivation, admin password resets, experiment and protocol review actions, task completion review decisions, organization setting changes, attachment actions, archived-item restoration, and invitation resend.

Admins can review these events in a dedicated Audit Logs page with filters for action, entity type, actor name, and target user name.

### Soft Delete and Auditability

To support research-lab traceability, LabFlow avoids permanently deleting core lab records. Projects, tasks, experiments, and protocols are archived instead. This keeps historical records available for audit trails while removing inactive items from normal working views.

### Organization Model and Data Isolation

A major backend architecture upgrade added organization-level ownership across the application. Users now belong to an organization, and core lab records are linked to that organization.

This allows LabFlow to move closer to a real multi-lab structure, where one lab's users, projects, tasks, protocols, equipment, audit logs, and review events are isolated from another lab's data.

The controller layer now scopes record access by the authenticated user's organization, and a dedicated organization isolation test suite verifies that cross-organization access is blocked.

### Organization Settings and Tenant Administration

LabFlow now includes a basic organization settings workflow. Admins can view and update the current organization’s name and type, while regular users can view the organization context but cannot change it.

The app always uses the authenticated user’s `organizationId` rather than accepting an organization ID from the request body or URL. This keeps organization settings scoped to the current tenant and avoids cross-organization updates.

Organization setting changes are written to the audit log, including previous and new values.

### Invitation List Management

Admins can view invitations for their organization, including invitee details, role, department, status, expiration date, invited-by information, and accepted date.

Pending invitations can be revoked from the admin interface. Accepted, revoked, and expired invitations remain visible for traceability.

The backend also provides organization-scoped resend support for pending and expired invitations.

## Challenges and Decisions

### 1. Separating Offline Equipment From Equipment In Use

A dashboard challenge was distinguishing equipment that is offline because of its inventory status from equipment that is temporarily in use because of an active booking.

I solved this by separating dashboard metrics into Equipment Offline and Equipment In Use Now.

### 2. Enforcing Booking Conflicts on the Backend

Equipment booking conflicts should not depend only on frontend validation.

I implemented the overlap check in the backend so confirmed equipment bookings cannot overlap even if a request is sent directly to the API.

### 3. Supporting Flexible Protocol Types

Protocols needed to support project methods, general SOPs, and equipment-specific SOPs.

I updated the model so protocols can optionally link to projects and equipment. This made the protocol workflow flexible enough for several lab use cases without creating separate models for every protocol type.

### 4. Handling Review Feedback

A simple review status was not enough because researchers need to know why changes were requested.

I added required review notes for change requests, stored the latest review comment on the reviewed record, and added review history events to preserve repeated review cycles.

### 5. Balancing Roles, Project Membership, and Researcher Permissions

A simple role-based access system was not enough for realistic lab workflows. Researchers may have different levels of independence, and project membership should limit where their permissions apply.

I solved this by combining system roles, project roles, and researcher workflow permissions. This allows admins, supervisors, project leads, project members, and project viewers to behave differently without making the permission model too broad.

### 6. Supporting Standalone Lab Tasks

Not all lab work belongs to a research project. Tasks such as restocking, equipment checks, freezer cleanup, or instrument tuning may be assigned independently.

I updated tasks so they can be standalone or project-linked, then adjusted researcher task access to be assignment-aware.

### 7. Preventing Accidental Access Loss

An access-control issue appeared when users could move records to another project after creation. A researcher could accidentally move a record into a project they could not access.

I solved this by locking project linkage after creation and treating project reassignment as a future admin-level workflow.

### 8. Making Dashboard Data Respect User Context

Dashboard data needed to change depending on the current user.

I separated project-linked dashboard filtering from task-specific assignment filtering. This allows researchers to see project-linked data only for their project memberships while still seeing standalone tasks assigned to them.

### 9. Supporting Different Researcher Review Requirements

Labs do not all use the same supervision model. Some supervisors review every experiment and protocol, while others allow experienced researchers to work independently until help is needed.

I added a researcher-level review policy that separates workflow permission from review requirement. Researchers who require review create records with `not_submitted`, while review-exempt researchers create records with `not_required`. The admin interface supports individual and bulk policy changes, and the backend enforces the behavior during experiment and protocol creation.

### 10. Separating Workspace Creation From User Onboarding

A key part of the latest LabFlow iteration was separating creation of a new lab workspace from onboarding users into an existing organization.

The public registration page now creates a new organization and its first administrator. The user provides the organization name, organization type, administrator name, email address, optional department, and password.

The backend normalizes the organization name into a URL-safe slug. If the slug already exists, LabFlow creates a unique suffix such as `-2` or `-3`.

Workspace registration runs inside a database transaction. The organization and first administrator are therefore created together. If either operation fails, the transaction rolls back and no partial workspace is left behind.

The backend also ignores client-supplied role, organization ID, activation, and researcher workflow fields. Public registration always creates the first user as an active administrator in the newly created organization.

### 11. Preventing Partial Onboarding Records

After the first administrator creates the workspace, additional users can join only through an administrator-created invitation.

An invitation stores the intended user’s:

- Name
- Email address
- Role
- Optional department
- Organization
- Researcher workflow permissions
- Review requirement
- Expiration date

The raw invitation token is embedded in the invitation link, but only its SHA-256 hash is stored in the database. Raw invitation links may be returned in development and test environments, while production sends the link by email without exposing it in the API response.

When the invited user opens the link, LabFlow shows the organization and invitation details. The user sets a password, and the backend creates the account using the organization, role, email address, and permissions stored on the invitation rather than accepting those fields from the client.

Invitation acceptance is transactional. User creation and the invitation status update either both succeed or both roll back. Accepted invitations cannot be reused.

User email addresses are currently globally unique, so one email address can belong to only one LabFlow organization. Supporting one account across multiple organizations would require a future membership model.

### 12. Making Demo Seeding Safe for Multiple Organizations

The demo seed workflow was updated for the new organization model.

Earlier seed behavior could clear records globally. The revised script finds or creates the dedicated `labflow-demo` organization and deletes only records belonging to that workspace.

All cleanup and demo data creation run within one database transaction. If the seed fails, the transaction rolls back instead of leaving the demo workspace partially populated.

This allows demo data to be safely refreshed without deleting organizations or records created through public workspace registration.

### 13. Designing Attachments Without Duplicating Notebook Files

A design question arose around whether notebook entries should have their own attachments.

Notebook entries already belong to experiments, and experiments belong to projects. Adding separate notebook-entry uploads would create several possible locations for the same file and make it harder for users to know where experiment data should be stored.

I decided to keep files at the experiment or project level:

- Project attachments store files relevant to the broader project.
- Experiment attachments store raw data, exports, images, calculations, and result files for a specific experiment.
- Notebook entries remain the chronological narrative of what was done and observed.

A future enhancement could allow notebook entries to reference existing experiment attachments without creating duplicate files.

### 14. Recovering Archived Records Without Accidental Cascades

Once LabFlow used soft archive behavior, administrators needed a safe way to recover records that had been archived accidentally or temporarily.

A simple recursive restore would have been risky. Restoring a project could unexpectedly reactivate tasks, experiments, protocols, and attachments that were intentionally archived for separate reasons.

I chose explicit, non-cascading recovery:

- Restore the project first.
- Restore each required child independently.
- Restore attachments only after their linked records are active.

This gives administrators control over exactly which records return to active workflows.

The backend checks organization ownership, direct-parent state, project state, upload status, and attachment storage availability. Successful restoration and audit creation share a database transaction.

For attachment restoration, Cloudflare R2 and PostgreSQL cannot share a transaction. I addressed this by verifying the object immediately before opening the database restoration transaction. A storage failure therefore leaves the attachment archived rather than creating an active database record that points to a missing file.

### 15. Separating Application Security From Third-Party Reputation Classification

The deployed Vercel hostname was classified as phishing by Kaspersky's reputation database. Kaspersky then blocked the frontend JavaScript and CSS assets. Even after a user chose to continue, the application remained blank because the JavaScript request was replaced or interrupted and returned HTML instead of the expected module MIME type.

The console showed blocked or interrupted asset requests, HTTP 499 responses, `NS_ERROR_CORRUPTED_CONTENT`, and a disallowed `text/html` MIME type for the JavaScript bundle. These were symptoms of the antivirus classification rather than defects in the React application.

The appropriate response is to submit the hostname for Kaspersky reanalysis and avoid asking users to disable protection. A stable custom domain is also planned, although it may still require reputation review.

## Result

LabFlow MVP Version 1.6 is complete and deployed as a portfolio/demo application.

The project includes:

- Full-stack React/Node/PostgreSQL application
- Deployed frontend, backend, and hosted database
- Role-based authentication and protected routes
- Project membership and project-specific access control
- Experiment, protocol, task, equipment, booking, notebook, and review workflows
- Equipment booking conflict prevention
- Review queue and review history
- Sequelize migrations
- Backend security hardening
- Archive behavior for projects, tasks, experiments, and protocols, with audit log coverage
- Seeded demo data and demo accounts
- Public workspace creation with first-administrator onboarding
- Invitation-only onboarding for additional users
- Provider-neutral invitation email delivery with Mailgun support, verified locally
- HTML and plain-text invitation templates
- Invitation delivery tracking and partial-failure handling
- Admin-only backend invitation resend with token rotation, renewed expiration, and audit logging
- Existing-session clearing and login handoff after invitation acceptance
- Self-service password reset with 30-minute token expiry
- Email verification with 24-hour token expiry and resend support
- Unverified-account access restrictions
- JWT `tokenVersion` invalidation after password resets
- Frontend stale-session cleanup, redirect, and one-time notice
- Transactional registration and invitation acceptance
- Multi-organization-safe demo seed behavior
- Secure research attachments for projects, tasks, experiments, protocols, and equipment
- Private Cloudflare R2 object storage
- Direct signed uploads and signed downloads
- Organization-scoped and parent-record-aware attachment authorization
- Metadata editing and soft archive behavior
- Cross-entity attachment permission coverage
- Comprehensive automated backend test coverage
- GitHub README and portfolio case study
- Admin-controlled recovery for archived projects, tasks, experiments, protocols, and attachments
- Parent-first and non-cascading restoration rules
- Cloudflare R2 verification before attachment restoration
- Transactional restore audit logging
- Admin Archived Items page with search, date filters, tabs, and pagination

## Current Limitations

LabFlow is intentionally focused on MVP workflows.

Current limitations include:

- The generated Vercel demo hostname is currently classified as phishing by Kaspersky's reputation database. A reanalysis request is needed, and a stable custom domain is planned.
- No rich-text editor or PDF export for experiment notebooks
- Password reset, email verification, invitation delivery, verification resend, and stale-session handling are implemented. Production verification covered workspace registration, verification-email delivery, resend, verification completion, and immediate post-verification access. Task reminders, booking reminders, and broader notification preferences are not yet included.
- Local Mailgun keys should currently be injected into the backend process or stored in an operating-system secret store rather than saved in the local `.env` file, because repeated automated key disabling was observed when stored there.
- No frontend automated tests yet
- No production-grade monitoring or centralized logging
- Organization isolation, workspace creation, first-administrator onboarding, invitation-based user onboarding, and basic settings exist, but multi-organization memberships, custom domains, subscriptions, billing, and full institutional tenant administration are not yet included.
- Equipment inventory metrics are organization-wide because equipment is not project-owned.
- Review history and audit logs are not yet immutable or signature-backed.
- User email addresses are globally unique, so one account cannot currently belong to multiple organizations.
- Notebook entries do not have separate file uploads. Experiment-related files are stored as experiment attachments, while project-wide files are stored as project attachments.
- Archived-item recovery is admin-only and intentionally non-cascading.
- PostgreSQL restoration and Cloudflare R2 verification cannot participate in one distributed transaction.
- The Archived Items page does not yet provide a read-only archived-record detail view.
- Attachment malware scanning, content inspection, storage quotas, multipart uploads, and physical deletion policies are not yet included.

## Future Improvements

Recommended future improvements include:

- Stable custom frontend and API domains
- Kaspersky and other reputation-service reclassification
- Expanded organization administration and tenant policies
- Multi-organization membership and organization switching
- Subscription and billing support
- Task, review, and booking notification preferences
- Secure local secret storage through Windows Credential Manager or PowerShell SecretManagement
- Production monitoring, centralized logging, alerting, and automated deployment/migration workflows
- Rich-text notebook entries and experiment notebook PDF export
- Equipment maintenance history and calendar-based bookings
- Frontend component and workflow tests
- Immutable audit controls, signatures, and export
- Project invitation and membership approval workflows
- Project-specific workflow permissions
- Equipment access rules for organization-wide, project-specific, or restricted instruments
- Attachment previews, malware scanning, retention policies, storage quotas, and multipart uploads
- Read-only archived-record detail views
- Workspace ownership transfer and additional organization-administrator management

## Portfolio Summary

LabFlow demonstrates practical full-stack application development with a real-world domain use case.

The project shows experience with:

- React frontend development
- Node/Express API design
- PostgreSQL relational data modeling
- Sequelize models, associations, and migrations
- JWT authentication
- Role-based and project-scoped authorization
- Backend validation for business rules
- Automated backend testing
- Deployment with Vercel, Render, and Neon PostgreSQL
- Translating scientific workflow knowledge into software features
