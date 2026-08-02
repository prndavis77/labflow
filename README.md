# LabFlow

LabFlow is a full-stack project management application for university research laboratories. It helps lab teams manage research projects, tasks, experiments, protocols, shared equipment, equipment bookings, review workflows, and project-specific access control in one centralized system.

The project is designed around a common academic lab problem: research work is often spread across email, spreadsheets, shared drives, informal messages, calendar tools, and paper or digital notebooks. LabFlow brings those workflows into a structured web application with role-based access, project membership, review history, equipment booking conflict prevention, and a deployed portfolio demo.

---

## Quick Links

- Live demo: `https://labflow-brown.vercel.app`
- Backend health check: `https://labflow-backend-p7im.onrender.com/api/health`
- Portfolio case study: `docs/case-study.md`
- Backend tests: `cd labflow-backend && npm test`

Demo accounts are listed below. The live demo uses seeded test data and should not be used with real laboratory, research, customer, or institutional data.

---

## Project Status

LabFlow MVP Version 1.5 is complete and deployed as a portfolio/demo application.

This version includes authentication, organization-based workspaces, invitation-based onboarding, provider-neutral invitation email delivery with Mailgun support verified locally, invitation delivery tracking, an admin-only backend resend workflow, role-based access control, admin user management, configurable researcher workflow permissions, project membership, membership-aware project access, role-aware dashboard filtering, standalone and project-linked task management, task completion review, experiment tracking, protocol management, equipment inventory, equipment booking with conflict prevention, dashboard metrics, review history, experiment-linked notebook entries, audit logging, end-to-end research file attachments, and admin-controlled recovery of archived records.

LabFlow now includes end-to-end research file attachments for projects, tasks, experiments, protocols, and equipment. Files are stored privately in Cloudflare R2 and uploaded directly using short-lived signed URLs.

Attachment access follows the linked record's permissions. Admins and authorized supervisors can manage all attachments within their scope. Researchers can upload where the parent workflow allows contribution and can edit or archive only files they uploaded. Read-only users can view and download attachments without seeing upload or management actions.

The backend includes a comprehensive Jest and Supertest suite covering authentication, authorization, organization isolation, invitations, email delivery, archive recovery, attachments, review workflows, and transactional rollback behavior.

### Phase 23A: Invitation Email Delivery

Completed:

- Added a provider-neutral email architecture with disabled and Mailgun providers.
- Added branded HTML and plain-text invitation email templates.
- Added Mailgun delivery after invitation creation without making invitation persistence depend on the external provider, and verified delivery locally.
- Added delivery tracking fields for status, provider, provider message ID, last attempt time, and sent time.
- Kept provider message IDs out of API responses.
- Added partial-failure behavior so an invitation remains valid when email delivery fails.
- Added an admin-only backend invitation resend endpoint with a new token, renewed expiration, and old-token invalidation.
- Added resend support for pending and expired invitations while blocking accepted and revoked invitations.
- Added transactional audit logging for invitation resend.
- Added production-safe invite-link behavior so raw links are not exposed in production responses.
- Updated invitation acceptance so any existing browser session is cleared before redirecting to login.
- Prefilled the invited email address on the login page after acceptance.
- Added focused and integration tests for configuration, templates, providers, delivery tracking, failure handling, resend, token invalidation, and organization isolation.

### Phase 22A: Archived Item Recovery

Completed:

- Added an admin-only Archived Items page.
- Added organization-scoped archived-item listing for projects, tasks, experiments, protocols, and attachments.
- Added search, archive-date filtering, and server-side pagination.
- Added restoration for projects, tasks, experiments, and protocols.
- Added attachment restoration with Cloudflare R2 object verification.
- Enforced parent-first restoration for project-linked records.
- Required the linked record and its project to be active before restoring a child attachment.
- Preserved each restored record's existing business and workflow status.
- Prevented restoration from cascading automatically to children, siblings, or attachments.
- Added idempotent handling for already-active records.
- Added transactional restore audit events.
- Added organization-isolation and cross-entity restoration tests.
- Verified the complete backend regression suite for archived-item recovery.

### Phase 20G: Researcher Review Policy

Completed:

- Added a researcher-level `requiresReview` policy field.
- Added review-exempt experiment and protocol creation using the `not_required` review status.
- Kept normal review workflow behavior for researchers who still require review.
- Added an individual Review Requirement switch to the admin user management table.
- Added bulk researcher controls for experiment permissions, protocol permissions, and review requirements.
- Added backend authorization and review-workflow tests for the new policy.
- Verified the full backend test suite.

### Phase 20B: Soft Delete / Archive

Completed:

- Added archive fields to projects, tasks, experiments, and protocols.
- Replaced hard delete behavior with archive behavior for tasks.
- Replaced hard delete behavior with archive behavior for experiments.
- Replaced hard delete behavior with archive behavior for protocols.
- Replaced hard delete behavior with archive behavior for projects.
- Updated frontend delete wording to archive wording.
- Added backend tests for archive behavior.

### Phase 20H: Workspace Creation and Invitation-Only Onboarding

Completed:

- Updated public registration so it creates a new organization workspace and its first administrator.
- Added normalized, unique organization slug generation.
- Restricted public organization types to lab, department, institution, and company.
- Removed public researcher account registration.
- Required additional admins, supervisors, and researchers to join through organization invitations.
- Added transactional workspace registration so organization and administrator creation succeed or roll back together.
- Added transactional invitation acceptance so user creation and invitation updates succeed or roll back together.
- Enforced globally unique user email addresses.
- Prevented accepted invitation tokens from being reused.
- Updated login, registration, and invitation acceptance wording.
- Added workspace registration and invitation security tests.
- Updated demo seeding so it resets only the dedicated demo organization and does not delete user-created workspaces.
- Expanded backend automated test coverage.

---

## What This Project Demonstrates

LabFlow demonstrates practical full-stack application development in a real-world scientific workflow domain.

Key technical areas include:

- React/Vite frontend with Ant Design UI
- Node.js and Express REST API
- PostgreSQL database modeled with Sequelize
- JWT authentication and protected routes
- Role-based access control for admin, supervisor, and researcher users
- Project membership and project-specific access rules
- Equipment booking conflict prevention
- Experiment, protocol, and task completion review workflows
- Review history event tracking
- Sequelize migrations for database schema management
- Jest and Supertest backend test coverage
- Demo deployment using Vercel, Render, and Neon PostgreSQL
- Basic backend hardening with Helmet, authentication rate limiting, and restricted CORS

---

## Live Demo

A deployed portfolio/demo version of LabFlow is available here:

```txt
https://labflow-brown.vercel.app
```

Portfolio case study: [docs/case-study.md](docs/case-study.md)

Demo backend health check:

```txt
https://labflow-backend-p7im.onrender.com/api/health
```

This deployment uses:

- Vercel for the React/Vite frontend
- Render for the Node/Express backend API
- Neon PostgreSQL for the hosted database

This is a portfolio/demo deployment with seeded test data. It should not be used with real laboratory, research, customer, or institutional data.

### Known Demo Access Issue

Kaspersky currently classifies the generated Vercel hostname `labflow-brown.vercel.app` as phishing. This is a third-party reputation/database classification and can cause Kaspersky to block the frontend JavaScript and CSS assets, leaving a blank page even after choosing to continue.

A reanalysis request should be submitted through the Kaspersky Threat Intelligence Portal. Users should not be instructed to disable antivirus protection. A stable custom production domain is also planned, although it may still require reputation review.

---

## Demo Login Credentials

Use one of the following demo accounts to explore the application:

```txt
Admin:
admin@labflow.test
password123

Supervisor:
anna.keller@labflow.test
password123

Researcher:
maria.schmidt@labflow.test
password123
```

The demo database may be reset periodically. Any changes made through the live demo should be treated as temporary test data.

---

## Problem LabFlow Solves

University laboratories often manage daily research work using disconnected tools:

- Spreadsheets for samples, methods, and schedules
- Email for supervisor feedback
- Shared drives for protocols and reports
- Calendar apps for equipment booking
- Informal messages for task updates
- Paper or digital notebooks for experiment notes

This can make it difficult to answer basic operational questions:

- Which projects are active?
- Which tasks are overdue?
- Which experiments need supervisor review?
- Which protocols are approved?
- Which equipment is currently booked?
- Are two researchers trying to book the same instrument at the same time?

LabFlow provides a structured system for managing these workflows in one place.

---

## Core Features

### Authentication

- Public workspace creation for a new organization and its first administrator
- Invitation-only account creation for additional admins, supervisors, and researchers
- Invitation emails through a provider-neutral email service with Mailgun support
- Invitation delivery tracking and an admin-only backend resend workflow
- Existing-session clearing after invitation acceptance before login
- User login
- JWT-based authentication
- Persistent login using stored token
- Logout flow
- Protected frontend routes
- Protected backend API routes

### Role-Based Access Control

LabFlow supports three user roles:

#### Admin

- Can manage projects
- Can manage protocols
- Can manage equipment inventory
- Can manage equipment bookings
- Can access all MVP resources
- Can view users
- Can change user roles
- Can configure researcher workflow permissions
- Can view and manage all project memberships
- Can view and restore archived projects, tasks, experiments, protocols, and attachments

#### Supervisor

- Can view and manage projects where they are assigned as the project supervisor
- Can manage project-linked workflows for supervised projects
- Can review experiments in supervised projects
- Can review project-linked protocols in supervised projects
- Can review general non-project-linked protocols
- Can review project-linked task completion requests in supervised projects
- Cannot review standalone task completion requests
- Can manage project memberships for supervised projects in the current MVP

#### Researcher

- Can view projects
- Can only view projects where they are project members
- Can view and update tasks assigned to them
- Can create standalone tasks assigned to themselves
- Can create project-linked tasks when project membership allows it
- Can create and update experiments when workflow permissions and project membership allow it
- Can view organization-wide equipment
- Can view general non-project-linked protocols
- Can view project-linked protocols when project membership permits access
- Can create and update protocols when workflow permissions and project membership allow it
- Cannot approve experiments or protocols
- Cannot request review changes
- Cannot manage equipment inventory
- Cannot delete protected records

Researcher workflow permissions allow admins to support different lab supervision styles. Some labs may allow researchers to independently create experiments and protocols, while other labs may require supervisor control over those workflows.

Public registration is reserved for creating a new organization workspace and its first administrator. Additional admins, supervisors, and researchers must be invited by an administrator from within the organization.

### Archive and Recovery

LabFlow uses soft archive behavior for core lab records instead of permanent deletion.

Supported archived record types include:

- Projects
- Tasks
- Experiments
- Protocols
- Attachments

Archived records are hidden from normal application lists but remain in PostgreSQL for traceability, auditability, and controlled recovery.

Admins can review archived records through the admin-only Archived Items page:

```txt
/admin/archived-items
```

The page provides:

- Separate tabs for each supported entity type
- Search by record title or attachment filename
- Archive-date filtering
- Server-side pagination
- Archive actor and timestamp information
- Restore confirmation
- Automatic list refresh after successful restoration

Restoration follows parent-first rules:

- A project must be restored before its archived project-linked task, experiment, or protocol.
- A child record must be restored before an attachment linked to that child.
- Project restoration does not automatically restore children.
- Child restoration does not automatically restore siblings or attachments.
- Restoring a record preserves its previous business and workflow status.

Attachment restoration also requires:

- An available upload status
- An existing linked target record
- An active linked target
- An active parent project where applicable
- Confirmation that the corresponding object still exists in private Cloudflare R2 storage

If the R2 object is missing, the attachment remains archived. Temporary storage failures also leave the database record unchanged.

Successful restoration writes an audit event in the same PostgreSQL transaction as the restore operation. Repeated restore requests for an already-active record return an idempotent response without creating duplicate audit events.

### Organization-Based Data Isolation

LabFlow now includes an organization model that prepares the application for multi-lab or multi-department use.

Each user belongs to an organization, and core records are organization-owned, including projects, tasks, experiments, protocols, equipment, equipment bookings, notebook entries, project members, review events, and audit logs.

Backend queries are scoped by the authenticated user's organization so users from one lab cannot access records from another lab. Cross-organization isolation is covered by automated tests.

### Organization-Based Lab Workspaces

LabFlow now supports organization-scoped lab workspaces. Each user belongs to an organization, and core records are scoped by `organizationId`, including projects, tasks, experiments, protocols, equipment, bookings, notebook entries, review events, and audit logs.

This allows the app to separate data between labs such as:

- DNA Laboratory
- Toxicology Laboratory
- Analytical Chemistry Unit

The active organization is also shown in the application UI so users can clearly see which lab workspace they are using.

Admins can also manage basic organization settings from the app, including the organization name and organization type. The active organization name is shown in the main UI so users can clearly see which lab workspace they are using.

### Workspace Creation and User Onboarding

LabFlow separates workspace creation from user onboarding.

A new customer or lab administrator can use the public registration page to create:

- A new organization workspace
- A unique organization slug
- The first administrator account for that organization

Public registration does not allow users to select a role, join an existing organization, or create a researcher account. The backend ignores client-supplied role, organization ID, activation, and workflow-permission fields.

After the workspace is created, additional users must be invited by an administrator. Invitations contain the user’s organization, email address, role, optional department, and researcher workflow permissions.

Invitation tokens are generated securely, but only a SHA-256 hash of the token is stored in the database. When the invitation is accepted, the account is created inside the invitation’s organization. The invitation is then marked as accepted and cannot be reused.

Workspace registration and invitation acceptance use database transactions so partial account or organization records are not left behind when an operation fails.

User email addresses are globally unique in the current architecture. Each account therefore belongs to one organization.

### Research File Attachments

LabFlow supports attachments for:

- Projects
- Tasks
- Experiments
- Protocols
- Equipment

The attachment workflow includes:

- Private Cloudflare R2 storage
- Direct browser-to-storage uploads
- Short-lived signed upload and download URLs
- Organization-scoped storage keys
- Parent-record permission enforcement
- Attachment categories and descriptions
- Metadata editing
- Soft archive behavior
- Upload verification
- Expired pending-upload cleanup
- Audit logging
- Shared frontend attachment components
- Researcher ownership restrictions for edit and archive actions

---

## Researcher Workflow Permissions and Review Policy

LabFlow includes configurable workflow permissions and review requirements for researcher accounts.

Admins can control whether each researcher can:

- Create experiments
- Edit experiments
- Create protocols
- Edit protocols
- Work under mandatory experiment and protocol review

Admins can change these settings individually from the user table or use bulk controls to update all researcher accounts at once. Bulk controls are available for experiment creation and editing, protocol creation and editing, and the review requirement.

When `requiresReview` is enabled, new experiments and protocols start with a review status of `not_submitted` and follow the normal review workflow.

When `requiresReview` is disabled, new experiments and protocols start with a review status of `not_required`. This allows experienced or trusted researchers to work independently while preserving a clear audit-friendly distinction between approved work and work that does not require formal review.

Admins have global workflow access. Supervisors have workflow access scoped to projects where they are assigned as the project supervisor. Researcher permissions provide finer control for labs with different supervision styles.

Researchers still cannot approve experiments, approve protocols, request review changes, or archive protected experiment/protocol records unless their role allows it.

---

## Project Membership and Access Control

LabFlow includes a project membership system that links users to specific projects.

Each project member has a project-specific role:

- Lead
- Member
- Viewer

Project membership adds a project-level access layer on top of system roles, supervisor project ownership, and researcher workflow permissions.

The current access model is:

- Admins can view and manage all projects.
- Supervisors can view and manage projects where they are assigned as the project supervisor.
- Researchers can only view projects where they are listed as project members.
- Researchers can create or edit project-linked experiments and protocols based on their project member role and workflow permissions. Project leads can create and edit project-linked experiments and protocols. Project members can create and edit them only when their researcher workflow permissions allow it. Project viewers have read-only access.
- Tasks may be standalone or project-linked. Researcher task visibility is assignment-aware, while project-linked task creation still respects project membership.
- Researcher workflow permissions still control whether a researcher can create or edit experiments and protocols at all.

For example, a researcher may have permission to create protocols, but they can only create project-linked protocols for projects where they are a member.

LabFlow also locks project linkage after record creation for tasks, experiments, and protocols. This prevents users from accidentally moving a record to a project they cannot access and losing the ability to correct it themselves.

### Project-Level Contribution Rules

LabFlow uses project member roles to control project-linked contribution rights:

- Project leads can coordinate project-linked work and can create or edit project-linked tasks, experiments, and protocols.
- Project members can contribute to project-linked experiments and protocols only when their researcher workflow permissions allow it.
- Project viewers have read-only access to project-linked tasks, experiments, and protocols.
- General SOPs without project linkage can be created, edited, reviewed, and archived only by admins and supervisors.
- Archive actions for core records remain restricted to admins and supervisors. Supervisors are scoped to projects they supervise for project-linked records.

This layered model allows LabFlow to combine global user roles, project-specific roles, and configurable researcher workflow permissions without giving researchers unrestricted access across the whole lab.

---

## MVP Version 1.5 Features

- Experiment-linked notebook entries
- Review Queue for supervisor/admin review workflows
- Review actions for experiments and protocols
- Review history for experiment and protocol review decisions
- Required review notes when requesting changes
- Admin user management
- Admin-controlled role changes
- Configurable researcher workflow permissions and review requirements
- Bulk researcher permission and review-policy controls
- Project membership model
- Project members section on project detail pages
- Membership-aware project access for researchers
- Permission-aware create/edit actions for experiments and protocols
- Project-linked experiment and protocol access rules
- Assignment-aware task access rules
- Locked project linkage after record creation
- Reusable experiment and protocol form modals
- Equipment-specific SOP support
- General lab SOP support without project linkage
- Detail pages for projects, tasks, experiments, protocols, and equipment
- Cross-linked navigation between related records
- Standalone and project-linked task support
- Researcher task completion requests
- Admin/supervisor task completion confirmation workflow
- Task completion requests in the Review Queue
- Role-aware dashboard filtering for researcher users
- Assignment-aware task dashboard summaries for researchers
- Supervisor-scoped project access
- Supervisor-scoped dashboard metrics
- Supervisor-scoped Review Queue visibility
- Supervisor-scoped review actions for experiments, project-linked protocols, and project-linked task completion requests
- General non-project-linked protocol review by admins and supervisors
- Admin-only standalone task completion review
- Project-role-aware create and edit rules for tasks, experiments, and protocols
- Lead/member/viewer project role behavior for project-linked work
- Project-aware create forms that block unauthorized selected projects before submission
- Supervisor-scoped delete permissions for project-linked tasks, experiments, and protocols
- Admin/supervisor-only management for general SOPs
- Audit logging for sensitive admin and review workflow actions, including role changes, workflow permission changes, account activation/deactivation, admin password resets, experiment reviews, protocol reviews, and task completion review decisions.
- Admin-only Audit Logs page with filtering by action, entity type, actor name, and target user name.
- Archive and recovery behavior for projects, tasks, experiments, protocols, and attachments, replacing permanent deletion for supported records.
- Role-based access control for admins, supervisors, and researchers
- Organization-scoped lab workspaces
- Admin-created invitations
- Provider-neutral invitation email service with Mailgun support verified locally
- HTML and plain-text invitation templates
- Invitation email delivery tracking
- Admin-only backend invitation resend with token rotation and renewed expiration
- Partial-failure handling when the email provider is unavailable
- Production-safe invite-link and provider-message-ID handling
- Session clearing and login handoff after invitation acceptance
- Secure invitation acceptance flow
- Public creation of a new organization workspace and first administrator
- Unique normalized organization slug generation
- Invitation-only onboarding for additional organization users
- Transactional workspace registration and invitation acceptance
- Globally unique account email enforcement
- Demo-only seed cleanup that preserves user-created organizations
- Visible active lab/workspace context in the UI
- Project, task, experiment, protocol, equipment, booking, notebook, review, archive, and audit-log workflows
- Organization settings page for admins
- Editable organization name and type
- Invitation list management with status, expiration, invited-by, and accepted-date details
- Pending invitation revoke action
- Private Cloudflare R2 object storage
- Short-lived signed upload and download URLs
- Organization-scoped attachment access
- Attachment audit logging
- Admin-only Archived Items page
- Organization-scoped archived-item recovery
- Archived project, task, experiment, protocol, and attachment tabs
- Archived-item search, date filtering, and pagination
- Parent-first restoration rules
- Non-cascading restoration behavior
- Attachment recovery with Cloudflare R2 object verification
- Transactional restoration audit events
- Idempotent restore handling
- Cross-entity restoration workflow tests
- Expired pending-upload cleanup
- Research attachments for projects, tasks, experiments, protocols, and equipment
- Reusable attachment list, upload, metadata-edit, download, and archive UI
- Role-aware attachment controls
- Researcher uploader-ownership enforcement
- Direct signed uploads to private Cloudflare R2 storage
- Signed downloads with storage-object verification
- Cross-entity attachment permission tests
- Backend test coverage for authentication, authorization, organization isolation, invitations, email delivery, resend, attachments, archive recovery, review workflows, and rollback behavior

### Dashboard

The dashboard provides a high-level overview of the lab workspace.

Current dashboard metrics include:

- Active projects
- Open tasks
- Overdue tasks
- Experiments needing review
- Pending protocols
- Upcoming equipment bookings
- Total equipment
- Equipment in use now
- Equipment offline
- Tasks awaiting completion review

The dashboard also includes summary tables for:

- Tasks due soon
- Experiments needing review
- Protocols pending review
- Upcoming equipment bookings
- Recent projects
- Recently updated tasks
- Recently updated experiments
- Task completion requests
- Recent notebook entries

The dashboard is role-aware. Admins see global dashboard metrics. Supervisors see dashboard metrics scoped to projects where they are assigned as the project supervisor. Researchers see project-linked dashboard data only for projects where they are members. Researcher task metrics are assignment-aware, so researcher dashboards show tasks assigned to that researcher, including standalone tasks without a project link.

Equipment inventory metrics are still global in the current MVP because equipment is not project-owned yet.

### Projects

Projects represent research initiatives inside a lab.

Project records include:

- Title
- Description
- Status
- Start date
- Target end date
- Supervisor

Project statuses include:

- Planning
- Active
- On Hold
- Completed
- Archived

Projects can have members. Project members connect users to specific research projects and prepare LabFlow for project-specific access control.

Project membership roles include:

- Lead
- Member
- Viewer

Project-related membership records include:

- Project
- User
- Project role
- Created date
- Updated date

Researchers can only see projects where they are members. Admins can view all projects. Supervisors can view projects where they are assigned as the project supervisor.

### Tasks

Tasks represent actionable lab work. Tasks may be linked to a project or saved as standalone lab tasks.

Task project linkage is optional. If a task is linked to a project during creation, that project link is locked afterward. This prevents accidental movement of a task to a project the user cannot access.

Task records include:

- Title
- Description
- Status
- Priority
- Due date
- Project
- Assigned user
- Created by user

Task statuses include:

- To Do
- In Progress
- Blocked
- Completion Requested
- Done

Researchers can mark assigned tasks as ready for completion review. This changes the task status to Completion Requested. Admins can confirm any task completion request, including standalone tasks. Supervisors can confirm or reopen project-linked task completion requests only for projects they supervise. Standalone task completion review is reserved for admins.

Task priorities include:

- Low
- Medium
- High
- Urgent

### Experiments

Experiments represent lab activities connected to research projects.

Experiments include review status and optional supervisor review comments. Admins can approve any experiment or request changes. Supervisors can approve experiments or request changes only for projects where they are assigned as the project supervisor.

Experiment create and edit actions are permission-aware. Admins and supervisors can create and edit experiments by role. Researcher access depends on configurable workflow permissions managed from the admin user management page.

Experiment project linkage is selected during experiment creation and locked afterward. Researchers must have both experiment workflow permission and project membership to create or edit project-linked experiments.

Experiment records include:

- Title
- Objective
- Notes
- Status
- Review status
- Started date
- Completed date
- Project
- Researcher
- Linked task
- Linked protocol
- Created by user

Experiment statuses include:

- Planned
- In Progress
- Waiting for Data
- Needs Review
- Completed
- Failed
- Repeated
- Archived

Review statuses include:

- Not Submitted
- Pending
- Approved
- Changes Requested
- Review Not Required

### Experiment Notebook Entries

Notebook entries are linked to experiments and provide a lightweight experiment notebook workflow.

Notebook entry records include:

- Title
- Entry type
- Content
- Content format
- Experiment
- Project
- Author
- Created date
- Updated date

Notebook entry types include:

- General Note
- Procedure
- Observation
- Result
- Issue
- Conclusion
- Supervisor Comment

Notebook entries appear on experiment detail pages, project detail pages, and the dashboard.

### Protocols

Protocols represent reusable lab methods, SOPs, or experimental procedures.

Protocols can be linked to a project, linked to equipment, linked to both, or saved as general lab SOPs without a project. This allows LabFlow to support project-specific methods, instrument SOPs, and general lab procedures.

Project-linked protocols require project membership for researcher create/edit access. General SOPs without a project are restricted to admins and supervisors. Researchers can view available protocols, but they cannot create or edit general SOPs, even when protocol workflow permissions are enabled. Protocol project linkage is locked after creation to avoid accidental access loss.

Protocol create and edit actions are permission-aware. Admins and supervisors can manage protocols by role. Researcher access depends on configurable workflow permissions, which allows labs to decide whether researchers may independently create or edit reusable methods and SOPs.

Admins can approve any protocol or request changes. Supervisors can approve project-linked protocols only for supervised projects. General non-project-linked protocols can be reviewed by admins and supervisors.

Protocol records include:

- Title
- Version
- Purpose
- Content
- Approval status
- Review status
- Review comment
- Project
- Equipment
- Created by user
- Approved by user
- Approved date

Protocol approval statuses include:

- Draft
- Pending Review
- Approved
- Changes Requested
- Archived

### Equipment Inventory

Equipment records represent shared lab instruments and resources.

Equipment records include:

- Name
- Type
- Location
- Status
- Notes

Equipment statuses include:

- Available
- Maintenance
- Out of Service
- Retired

### Equipment Booking

Equipment bookings allow users to reserve shared lab instruments.

Booking records include:

- Booking title
- Equipment
- Booking user
- Start time
- End time
- Status
- Project
- Experiment
- Purpose

Booking statuses include:

- Confirmed
- Cancelled
- Completed

The backend prevents overlapping confirmed bookings for the same equipment.

For example, if an HPLC is booked from 09:00 to 11:00, another confirmed booking for the same HPLC from 10:00 to 12:00 will be rejected with a conflict error.

### Audit Logs

Admins can view audit logs through:

`GET /api/audit-logs`

Supported filters include:

- `action`
- `entityType`
- `actorName`
- `targetName`
- `actorUserId`
- `targetUserId`
- `page`
- `limit`

---

## Review Workflow

LabFlow includes review workflows for experiments, protocols, and task completion requests.

Admins can use the Review Queue across all records. Supervisors can use the Review Queue for records in projects they supervise, plus general non-project-linked protocols.

Review actions are also enforced on the backend, so users cannot bypass the UI by sending direct API requests.

Task completion requests appear in the Review Queue, but the final Confirm Done or Reopen Task decision is handled on the task detail page so reviewers can inspect the task context before taking action.

For context-heavy decisions, reviewers can open the experiment or protocol detail page. Detail pages provide access to the full record and include review actions.

When requesting changes, reviewers must provide a review note explaining what needs to be corrected, clarified, repeated, or improved. The latest review comment is displayed on the detail page so researchers can see what action is needed.

LabFlow also stores review history events for approvals and change requests. This allows repeated review cycles to be preserved instead of replacing earlier feedback. The latest review feedback is still shown on the detail page as the current actionable note, while the Review History section shows the full trail of previous decisions.

---

## Admin User Management

LabFlow includes an admin-only user management page.

Admins can:

- View all users
- Filter users by role
- Change another user's role
- Configure individual researcher workflow permissions
- Configure whether individual researchers require experiment and protocol review
- Apply bulk experiment, protocol, and review-policy settings to all researchers
- View account creation and update dates

The interface prevents admins from changing their own role from the admin users page. The backend also protects role updates and permission updates so only admin users can perform those actions.

Workflow permission controls are shown for researcher accounts. Admin and supervisor accounts show full access by role.

### Invitation-Based Onboarding

Admins can invite users into their organization instead of relying only on public registration.

The invitation flow includes:

1. An admin creates an invitation with name, email, role, optional department, and researcher permissions.
2. LabFlow generates a cryptographically secure token and stores only its SHA-256 hash.
3. LabFlow commits the invitation and audit event before attempting external email delivery.
4. The email service sends branded HTML and plain-text invitation messages through Mailgun when enabled.
5. Delivery status, provider, provider message ID, last attempt time, and sent time are recorded.
6. The invited user opens the link and sets a password.
7. LabFlow creates the user inside the invitation's organization and marks the invitation as accepted.
8. Any existing browser session is cleared, and the user is redirected to login with the invited email prefilled.

Email delivery does not control whether the invitation is valid. If the provider fails, the invitation remains pending and the API reports a partial-delivery failure.

The backend provides an admin-only resend operation for pending and expired invitations. Resend generates a new token, invalidates the old link, renews the expiration date, resets delivery tracking, writes an audit event, and attempts to send the replacement email. Accepted and revoked invitations cannot be resent.

Raw invitation links may be returned in development and test environments for local testing. Production responses do not expose raw invitation links or provider message IDs.

Admins can view an invitation list showing invitee name, email, role, department, status, expiration date, invited date, invited-by information, accepted date, and email delivery state. Pending invitations can be revoked from the interface. The backend also supports organization-scoped resend for pending and expired invitations.

---

## Screenshots

### Dashboard

![LabFlow dashboard showing project, task, experiment, protocol, and equipment metrics](docs/screenshots/dashboard.png)

### Project Members

![LabFlow project detail page showing project members and project-specific roles](docs/screenshots/project-members.png)

### Admin User Management

![LabFlow admin user management page showing researcher workflow permission controls](docs/screenshots/admin-user-management.png)

### Review Queue

![LabFlow review queue showing supervisor and admin review workflows](docs/screenshots/review-queue.png)

### Experiment Review Actions

![LabFlow experiment detail page showing approve and request changes review actions](docs/screenshots/experiment-review-actions.png)

### Review History

![LabFlow experiment detail page showing review history events for repeated review cycles](docs/screenshots/review-history.png)

### Experiment Notebook

![LabFlow experiment notebook showing experiment-linked notebook entries](docs/screenshots/experiment-notebook.png)

### Protocol Review Comment

![LabFlow protocol detail page showing latest review comment and protocol approval workflow](docs/screenshots/protocol-review-comment.png)

### Equipment Bookings

![LabFlow equipment bookings page showing instrument reservations, users, time ranges, projects, and experiments](docs/screenshots/equipment-bookings.png)

### Booking Conflict Prevention

![LabFlow booking conflict error showing that overlapping confirmed equipment bookings are rejected](docs/screenshots/booking-conflict.png)

### Equipment SOPs

![LabFlow equipment detail page showing linked instrument SOPs and bookings](docs/screenshots/equipment-detail-sops.png)

### Archived Items

![LabFlow admin Archived Items page for restoring archived projects, tasks, experiments, protocols, and attachments](docs/screenshots/archived-items.png)

Additional screenshots for CRUD list pages are available in `docs/screenshots/`.

---

## Technical Highlights

LabFlow demonstrates several full-stack development concepts:

- React frontend with Vite
- Ant Design UI components
- Node.js and Express backend
- PostgreSQL relational database
- Sequelize ORM models and associations
- Sequelize migrations for database schema management
- Jest and Supertest backend test suite
- Automated tests for authentication, authorization, project membership access, equipment booking conflicts, task completion review, and experiment/protocol review workflows
- JWT authentication
- Password hashing with bcrypt
- Role-based route authorization
- Protected frontend routes
- REST API architecture
- Reusable API client layer with Axios
- Complex model relationships
- Equipment booking conflict detection
- Dashboard summary endpoint
- Seed data script for demo data
- Manual regression-tested MVP workflow
- Experiment-linked notebook entry workflow
- Review Queue for supervisor/admin workflows
- Required review notes for change requests
- Flexible protocol model for project protocols, equipment SOPs, and general SOPs
- Cross-linked detail pages for related lab records
- Admin user management with role update workflow
- Configurable researcher workflow permissions and review requirements
- Bulk researcher permission and review-policy controls
- Permission-aware frontend actions backed by backend authorization
- Reusable experiment and protocol form modals
- Detail-page editing through shared modal components
- Project membership model with unique project/user membership enforcement
- Membership-aware project visibility for researchers
- Membership-aware project-linked experiment and protocol access rules
- Assignment-aware task access rules for researchers
- Locked project linkage on existing records to prevent accidental access loss
- Role-aware dashboard filtering for project-linked researcher data
- Assignment-aware task dashboard summaries for researchers
- Standalone and project-linked task model
- Task completion request workflow with admin/supervisor confirmation
- Review Queue support for task completion requests
- Security headers with Helmet
- Authentication route rate limiting
- Restricted CORS configuration for local and deployed frontend origins
- Provider-neutral email delivery architecture
- Mailgun Domain Sending Key support through the Mailgun HTTP API
- HTML and plain-text invitation email templates
- Invitation delivery tracking and resend with token rotation
- External-provider failure isolation so invitation persistence is preserved
- Organization-based data ownership and backend query scoping
- Cross-organization isolation tests for projects, tasks, and audit logs
- Generic attachment system for multiple LabFlow entity types
- Private Cloudflare R2 object storage
- Direct-to-storage uploads using short-lived signed URLs
- Signed download URLs with storage-object verification
- Organization-scoped and target-aware attachment authorization
- Attachment metadata updates, soft archive behavior, and storage-verified restoration
- Expired pending-upload cleanup with row locking
- Admin-only cross-entity archived-item recovery
- Parent-first restoration validation
- Transactional restore and audit-log creation
- Cloudflare R2 object verification before attachment restoration
- Idempotent restore operations
- Cross-entity restoration regression tests

---

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
- dotenv
- cors
- Helmet
- express-rate-limit
- mailgun.js
- form-data
- Cloudflare R2 through the S3-compatible API
- AWS SDK for JavaScript S3 client and URL presigning

### Testing

- Jest
- Supertest

### Development Tools

- npm
- Nodemon
- Postman
- pgAdmin or psql
- Git and GitHub

---

## Project Structure

```txt
labflow/
  labflow-backend/
    src/
      config/
        attachmentConfig.js
        database.js
        emailConfig.js
        sequelize-cli.js
      constants/
        archivedItems.js
        attachments.js
        auditActions.js
        invitationEmail.js
        roles.js
        statusCodes.js
      controllers/
        archivedItemController.js
        attachmentController.js
        auditLogController.js
        authController.js
        dashboardController.js
        equipmentBookingController.js
        equipmentController.js
        experimentController.js
        invitationController.js
        notebookEntryController.js
        organizationController.js
        projectController.js
        projectMemberController.js
        protocolController.js
        reviewEventController.js
        taskController.js
        userController.js
      email/
        providers/
          disabledEmailProvider.js
          mailgunEmailProvider.js
        templates/
          invitationEmail.js
        createEmailProvider.js
      middleware/
        authMiddleware.js
      migrations/
        20260622122950-initial-labflow-schema.js
        20260625133918-add-user-account-status.js
        20260626130549-create-audit-logs.js
        20260628153801-add-archive-fields-to-core-records.js
        20260702103623-add-organizations-and-user-organization.js
        20260702155102-add-organization-id-to-core-records.js
        20260706101545-create-invitations.js
        20260707201348-add-department-to-invitations.js
        20260711125439-add-requires-review-to-users.js
        20260711160206-add-not-required-experiment-review-status.js
        20260711225539-add-review-status-to-protocols.js
        20260724101117-create-attachments.js
        20260801183056-add-invitation-email-delivery-tracking.js
      models/
        Attachment.js
        AuditLog.js
        Equipment.js
        EquipmentBooking.js
        Experiment.js
        index.js
        Invitation.js
        NotebookEntry.js
        Organization.js
        Project.js
        ProjectMember.js
        Protocol.js
        ReviewEvent.js
        Task.js
        User.js
      routes/
        archivedItemRoutes.js
        attachmentRoutes.js
        auditLogRoutes.js
        authRoutes.js
        dashboardRoutes.js
        equipmentBookingRoutes.js
        equipmentRoutes.js
        experimentRoutes.js
        invitationRoutes.js
        notebookEntryRoutes.js
        organizationRoutes.js
        projectMemberRoutes.js
        projectRoutes.js
        protocolRoutes.js
        reviewEventRoutes.js
        taskRoutes.js
        userRoutes.js
      scripts/
        cleanupPendingAttachments.js
        seedDemoData.js
        setupDatabase.js
      seeders/
      services/
        attachmentCleanupService.js
        emailService.js
        invitationEmailService.js
      storage/
        providers/
          r2AttachmentStorage.js
        utils/
          contentDisposition.js
          storageKey.js
        attachmentStorage.js
        createAttachmentStorage.js
      tests/
        helpers/
          dbHelpers.js
          testHelpers.js
        archivedItems.test.js
        attachmentAccess.test.js
        attachmentCleanup.test.js
        attachmentDownloads.test.js
        attachmentMutations.test.js
        attachmentReads.test.js
        attachmentStorage.test.js
        attachmentUploads.test.js
        attachmentValidation.test.js
        auditLogs.test.js
        auth.test.js
        authorization.test.js
        emailConfig.test.js
        emailService.test.js
        equipmentBookingConflict.test.js
        health.test.js
        invitationControllerEmail.test.js
        invitationEmail.test.js
        invitationEmailService.test.js
        invitationEmailTracking.test.js
        invitations.test.js
        organizationIsolation.test.js
        organizationSettings.test.js
        organizationSlug.test.js
        projectMembershipAccess.test.js
        reviewWorkflow.test.js
        setupTests.js
        taskCompletionReview.test.js
        workspaceRegistration.test.js
      utils/
        attachmentAccess.js
        attachmentResponse.js
        attachmentValidation.js
        auditLogger.js
        dateUtils.js
        formatUserResponse.js
        generateToken.js
        invitationTokens.js
        organizationSlug.js
        projectAccess.js
        workflowPermissions.js
      server.js

  labflow-frontend/
    src/
      api/
        attachmentApi.js
        authApi.js
        axiosClient.js
        dashboardApi.js
        equipmentApi.js
        equipmentBookingApi.js
        experimentApi.js
        invitationApi.js
        notebookEntryApi.js
        organizationApi.js
        projectApi.js
        projectMemberApi.js
        protocolApi.js
        reviewEventApi.js
        taskApi.js
        userApi.js
      assets/
      components/
        attachments/
          AttachmentList.jsx
          AttachmentListItem.jsx
          AttachmentMetadataModal.jsx
          AttachmentSection.jsx
          AttachmentUploadModal.jsx
        experiments/
          ExperimentFormModal.jsx
        projects/
          ProjectFormModal.jsx
          ProjectMembersCard.jsx
        protocols/
          ProtocolFormModal.jsx
        tasks/
          TaskFormModal.jsx
        users/
          InvitationList.jsx
          InviteUserModal.jsx
        ScrollToTop.jsx
      constants/
         actionOptions.js
         attachmentOptions.js
         entityTypeOptions.js
         statusColors.js
         statusOptions.js
      context/
         AuthContext.js
         AuthProvider.jsx
         useAuth.js
      layouts/
      pages/
        AcceptInvitePage.jsx
        AdminArchivedItemsPage.jsx
        AdminAuditLogsPage.jsx
        AdminUsersPage.jsx
        DashboardPage.jsx
        EquipmentDetailPage.jsx
        EquipmentPage.jsx
        ExperimentDetailPage.jsx
        ExperimentsPage.jsx
        LoginPage.jsx
        NotFoundPage.jsx
        OrganizationSettingsPage.jsx
        ProjectDetailPage.jsx
        ProjectsPage.jsx
        ProtocolDetailPage.jsx
        ProtocolsPage.jsx
        RegisterPage.jsx
        ReviewQueuePage.jsx
        TaskDetailPage.jsx
        TasksPage.jsx
      routes/
        AppRoutes.jsx
        ProtectedRoute.jsx
        PublicOnlyRoute.jsx
      services/
        archivedItemService.js
        attachmentUploadService.js
        auditLogService.js
      utils/
        attachmentUtils.js
        formatters.js
        projectRoleAccess.js
      App.jsx
      main.jsx

```

---

## Database Models

LabFlow MVP Version 1.5 includes the following main models.

### User

Stores authenticated users and their roles.

Relationships:

- User can supervise many projects
- User can be assigned many tasks
- User can create many tasks
- User can perform many experiments
- User can create many experiments
- User can create and approve protocols
- User can create equipment bookings
- User can author notebook entries
- User can have many project memberships

### Project

Represents a research project.

Relationships:

- Project belongs to one supervisor
- Project may have many linked tasks
- Project has many experiments
- Project has many protocols
- Project has many equipment bookings
- Project has many notebook entries
- Project has many project members

### ProjectMember

Represents a user's membership in a project.

Relationships:

- Project member belongs to one project
- Project member belongs to one user
- Project has many project members
- User has many project memberships

Project member roles include:

- Lead
- Member
- Viewer

A user can only be added once to the same project.

### Task

Represents a standalone or project-linked lab action item.

Relationships:

- Task may belong to one project
- Task may be assigned to one user
- Task is created by one user
- Task may have related experiments

### Experiment

Represents a lab activity or experimental run.

Relationships:

- Experiment belongs to one project
- Experiment belongs to one researcher
- Experiment may be linked to one task
- Experiment may use one protocol
- Experiment may have equipment bookings
- Experiment has many notebook entries

### Protocol

Represents a reusable lab method, SOP, or experimental procedure.

Relationships:

- Protocol may belong to one project
- Protocol may belong to one equipment item
- Protocol is created by one user
- Protocol may be approved by one user
- Protocol may be used by many experiments

### Equipment

Represents a shared lab instrument.

Relationships:

- Equipment has many bookings
- Equipment may have many linked SOPs or protocols

### EquipmentBooking

Represents a reserved equipment time slot.

Relationships:

- Booking belongs to one equipment item
- Booking belongs to one user
- Booking may be linked to one project
- Booking may be linked to one experiment

### NotebookEntry

Represents an experiment-linked notebook record.

Relationships:

- Notebook entry belongs to one experiment
- Notebook entry belongs to one project
- Notebook entry belongs to one author

### Attachment

Represents a file associated with a supported LabFlow record.

Attachment metadata is stored in PostgreSQL, while file content is stored in private Cloudflare R2 storage.

Attachment records include:

- Organization
- Uploader
- Original filename
- Sanitized filename
- MIME type
- Expected and verified file size
- Storage provider
- Private storage key
- Target entity type and ID
- Category
- Description
- Upload status
- Upload expiration
- Archive status and archive actor
- Checksum and ETag metadata

Attachment upload statuses include:

- Pending
- Available
- Failed

Attachment access follows access to the linked LabFlow record.

---

## API Overview

### Authentication

```txt
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
```

### Users

```txt
GET /api/users
GET    /api/users/:id
PATCH  /api/users/:id/role
PATCH  /api/users/:id/permissions
```

### Dashboard

```txt
GET /api/dashboard/summary
```

### Projects

```txt
GET /api/projects
GET /api/projects/:id
POST /api/projects
PATCH /api/projects/:id
DELETE /api/projects/:id
```

### Project Members

```txt
GET    /api/project-members
GET    /api/project-members/:id
POST   /api/project-members
PATCH  /api/project-members/:id
DELETE /api/project-members/:id
```

### Tasks

```txt
GET /api/tasks
GET /api/tasks/:id
POST /api/tasks
PATCH /api/tasks/:id
DELETE /api/tasks/:id
```

### Experiments

```txt
GET /api/experiments
GET /api/experiments/:id
POST /api/experiments
PATCH /api/experiments/:id
DELETE /api/experiments/:id
```

### Protocols

```txt
GET /api/protocols
GET /api/protocols/:id
POST /api/protocols
PATCH /api/protocols/:id
DELETE /api/protocols/:id
```

### Equipment

```txt
GET /api/equipment
GET /api/equipment/:id
POST /api/equipment
PATCH /api/equipment/:id
DELETE /api/equipment/:id
```

### Equipment Bookings

```txt
GET /api/equipment-bookings
GET /api/equipment-bookings/:id
POST /api/equipment-bookings
PATCH /api/equipment-bookings/:id
DELETE /api/equipment-bookings/:id
```

### Notebook Entries

```txt
GET    /api/notebook-entries
GET    /api/notebook-entries/:id
POST   /api/notebook-entries
PATCH  /api/notebook-entries/:id
DELETE /api/notebook-entries/:id
```

### Invitations

```txt
POST   /api/invitations
GET    /api/invitations
GET    /api/invitations/accept/:token
POST   /api/invitations/accept/:token
POST   /api/invitations/:id/resend
PATCH  /api/invitations/:id/revoke
```

### Attachments

```txt
GET    /api/attachments
POST   /api/attachments/uploads
POST   /api/attachments/:id/complete
GET    /api/attachments/:id/download
POST   /api/attachments/:id/archive
PATCH  /api/attachments/:id
GET    /api/attachments/:id
```

Attachment metadata is stored in PostgreSQL, while file content is stored in private Cloudflare R2 storage. Access follows access to the linked LabFlow record.

See [docs/attachments.md](docs/attachments.md) for the complete attachment architecture, security model, API workflow, and cleanup process.

### Archived Items

```txt
GET  /api/admin/archived-items
POST /api/admin/archived-items/:entityType/:id/restore
```

Supported entityType values:

- project
- task
- experiment
- protocol
- attachment

The listing endpoint is admin-only and organization-scoped. It supports:

- entityType
- search
- page
- limit
- archivedById
- archivedFrom
- archivedTo
- projectId for supported project-linked entity types

Restoration is admin-only and organization-scoped.

Projects, tasks, experiments, and protocols use integer record IDs. Attachments use UUIDs.

Attachment restoration verifies that the stored object exists in Cloudflare R2 before clearing archive metadata.

---

## Security and Deployment Notes

LabFlow is currently prepared for portfolio/demo deployment. It should not be used with real laboratory or research data without additional production hardening.

Production environment variables should be stored only in the hosting provider's environment variable settings. Do not commit real `.env` files, database URLs, JWT secrets, or production credentials to Git.

Mailgun production credentials should be stored only in the Render backend service environment. Use a separate Mailgun Domain Sending Key for each environment. Do not expose the key to the Vite frontend, prefix it with `VITE_`, print it in logs, or store it in committed configuration.

In the current local development environment, Mailgun repeatedly disabled keys stored in the local `.env` file. A key injected only into the PowerShell process remained usable during testing. Local Mailgun keys should therefore be supplied through a temporary process environment variable or an operating-system secret store until the local `.env` exposure source is identified.

LabFlow includes basic backend hardening for the demo API, including security headers with Helmet, authentication rate limiting, restricted CORS origins, JWT authentication, password hashing, protected routes, role-based authorization, and project-scoped backend access checks.

Public registration creates a new organization workspace and its first administrator. Additional admins, supervisors, and researchers must be invited by an administrator from within the organization.

The included demo seed data uses shared demo credentials for portfolio testing. These credentials are not suitable for real production use.

The `npm run seed` command is intended for local and demo setup only. The seed script removes and recreates records belonging only to the dedicated `labflow-demo` organization. It does not delete data from other organizations. It should not be run against a real production database with customer or research records.

LabFlow now includes a Sequelize migration baseline for the current MVP schema. New databases should be initialized with migrations instead of relying on Sequelize schema sync.

The `npm run setup:db` command is kept only as a legacy/demo fallback from the original MVP deployment path. It uses Sequelize schema sync and should not be run casually against a live database containing real user data.

Before LabFlow is used as real production software, additional hardening would still be required, including email verification, centralized logging, monitoring, stricter secrets management, account lockout rules, expanded tenant administration, immutable audit controls, and a more complete production deployment process.

### Production Deployment Safety

Production migrations should be run intentionally and only after local backend tests pass.

Before running production migrations:

- Confirm `npm test` passes locally against the test database.
- Confirm the production database URL is used only in the current terminal session.
- Check migration status before and after running migrations.
- Do not run `npm test` or `npm run seed` against production.
- Clear production environment variables after migration commands.

See `docs/production-deployment.md` for the full deployment checklist.

---

## Local Setup

### Prerequisites

Make sure you have installed:

- Node.js
- npm
- PostgreSQL
- Git

### Backend Setup

Navigate to the backend folder:

```bash
cd labflow-backend
```

Install dependencies:

```bash
npm install
```

Create a .env file:

```env
PORT=5000
DATABASE_URL=postgres://postgres:your_password@localhost:5432/labflow_db
JWT_SECRET=replace_this_with_a_long_random_secret
NODE_ENV=development
FRONTEND_URL=http://localhost:5173

EMAIL_PROVIDER=disabled
EMAIL_FROM_NAME=LabFlow
EMAIL_FROM_ADDRESS=labflow@example.com

MAILGUN_API_KEY=
MAILGUN_DOMAIN=mg.example.com
MAILGUN_API_BASE_URL=https://api.mailgun.net

ATTACHMENT_STORAGE_PROVIDER=r2
ATTACHMENT_MAX_FILE_SIZE_BYTES=26214400
ATTACHMENT_PENDING_TTL_MINUTES=30
ATTACHMENT_UPLOAD_URL_TTL_SECONDS=300
ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS=60
ATTACHMENT_CLEANUP_BATCH_SIZE=100

R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
R2_BUCKET_NAME=your_private_r2_bucket_name
```

Use `EMAIL_PROVIDER=disabled` when local email delivery is not needed.

In the current development environment, do not store a working Mailgun key in `.env`. Supply it through a temporary process environment variable or an operating-system secret store.

The R2 values are required when `ATTACHMENT_STORAGE_PROVIDER=r2`.

Never commit real `.env` files or R2 credentials. Use `.env.example` only as a variable-name reference.

Create the PostgreSQL database:

```sql
CREATE DATABASE labflow_db;
```

Run database migrations from the backend folder:

```bash
npm run migrate
```

Optional: seed the database with demo data:

```bash
npm run seed
```

The seed script is intended for local and portfolio/demo setup only. The seed script removes and recreates records belonging only to the dedicated `labflow-demo` organization. It does not delete data from other organizations.

Start the backend:

```bash
npm run dev
```

The backend should run on:

```txt
http://localhost:5000
```

Health check:

```txt
GET http://localhost:5000/api/health
```

### Frontend Setup

Navigate to the frontend folder:

```bash
cd labflow-frontend
```

Install dependencies:

```bash
npm install
```

Create a .env file:

```env
VITE_API_URL=http://localhost:5000/api
```

Start the frontend:

```bash
npm run dev
```

The frontend should run on:

```txt
http://localhost:5173
```

### Demo Seed Data

LabFlow includes a demo seed script that creates realistic test data.

The seed script creates:

- Demo users
- Demo projects
- Demo tasks
- Demo experiments
- Demo protocols
- Equipment-specific SOPs
- Demo equipment
- Demo equipment bookings
- Demo notebook entries
- Review queue examples
- Review comments
- Demo review history events
- Researcher workflow permission examples
- Demo project memberships
- Project-specific researcher access examples
- Standalone lab tasks
- Task completion request examples

Run the seed script from the backend folder:

```bash
cd labflow-backend
npm run seed
```

Warning: The seed script removes and recreates records belonging only to the dedicated `labflow-demo` organization. It does not delete data from other organizations.

### Database Migrations

LabFlow uses Sequelize migrations to manage the database schema.

For a fresh database, run:

```bash
cd labflow-backend
npm run migrate
```

Then optionally seed the demo data:

```bash
npm run seed
```

The initial migration creates the current MVP schema, including users, projects, project memberships, tasks, experiments, protocols, equipment, equipment bookings, notebook entries, review events, enums, indexes, and foreign key relationships.

For an existing deployed demo database that was originally created with `npm run setup:db`, the initial baseline migration should be marked as already applied in `SequelizeMeta`. The initial migration should not be run directly against an existing database that already has the LabFlow tables.

Useful migration commands:

```bash
npm run migrate
npm run migrate:undo
npm run migrate:undo:all
npx sequelize-cli db:migrate:status
```

The `npm run setup:db` command remains in the project only as a legacy/demo fallback. New schema changes should be handled with migrations, not with `sequelize.sync({ alter: true })`.

### Demo Accounts

```txt
Admin:
admin@labflow.test
password123

Supervisor:
anna.keller@labflow.test
password123

Researcher 1:
maria.schmidt@labflow.test
password123

Researcher 2:
jonas.weber@labflow.test
password123

Researcher 3:
sam.dean@labflow.test
password123
```

These credentials are for local development and demo use only.

The demo seed data includes project memberships to demonstrate project-specific access.

Researchers intentionally have different project memberships and workflow permissions. This allows the demo to show that a researcher may have permission to create a type of record, such as protocols, while still being limited to projects where they are a member.

The seed data also demonstrates that project links for tasks, experiments, and protocols are selected during creation and locked afterward.

The seed data also includes standalone lab tasks, such as equipment maintenance or freezer restocking tasks, to demonstrate that not all lab work belongs to a research project.

The demo researcher accounts intentionally use different project memberships and workflow permission profiles:

- Maria Schmidt can access only her assigned project memberships. She can create and edit experiments, but cannot create or edit protocols.
- Jonas Weber can access his assigned project memberships and can create and edit both experiments and protocols.
- Sam Dean demonstrates protocol permissions without experiment permissions.

This demonstrates how LabFlow can support different lab supervision styles while still limiting researchers to the projects where they are members.

The demo seed script manages only the dedicated `labflow-demo` organization. Reseeding removes and recreates records belonging to that demo workspace without truncating or deleting data from other organizations.

The seeded workspace includes admins, supervisors, researchers with different workflow and review policies, project leads and members, review history, notebook entries, equipment, bookings, and representative project workflows.

---

## Manual Regression Test Coverage

LabFlow MVP Version 1.5 was manually tested across the following workflows:

### Authentication

- Create a new organization workspace and first administrator
- Prevent public researcher registration
- Accept an administrator-created invitation
- Prevent reuse of an accepted invitation
- Login existing user
- Persist login after refresh
- Logout
- Prevent logged-in users from accessing login/register pages

### Projects

- Create project
- Edit project
- Archive project
- View projects as researcher
- Restrict project management actions by role

### Project Membership

- Add a user to a project as admin/supervisor
- Prevent duplicate project membership
- Change a project member role
- Remove a project member
- Show project members on project detail pages
- Hide membership management actions from researchers
- Restrict project membership create/update/delete to admin and supervisor users

### Membership-Aware Access

- Researcher can view only projects where they are a member
- Researcher cannot open a non-member project detail page by direct URL
- Researcher can create project-linked tasks only for member projects
- Researcher can create project-linked experiments only when workflow permissions and project membership allow it
- Researcher can create project-linked protocols only when workflow permissions and project membership allow it
- Researcher cannot change the project link on an existing task
- Researcher cannot change the project link on an existing experiment
- Researcher cannot change the project link on an existing protocol
- Admin can still view all projects
- Supervisor can view only projects where they are assigned as supervisor
- Supervisor cannot open a non-supervised project detail page by direct URL
- Project lead can create and edit project-linked experiments even when global workflow flags are disabled
- Project lead can create and edit project-linked protocols even when global workflow flags are disabled
- Project member can create and edit project-linked experiments only when workflow permissions allow it
- Project member can create and edit project-linked protocols only when workflow permissions allow it
- Project viewer has read-only access to project-linked tasks, experiments, and protocols
- Researcher cannot create or edit general SOPs
- Unauthorized selected projects are blocked in create forms before submission

### Tasks

- Create task
- Assign task to user
- Link task to project
- Edit task
- Filter tasks
- Restrict task archiving by role
- Create standalone task without project linkage
- Create project-linked task
- Show assigned standalone tasks to researchers
- Hide tasks assigned to other researchers from researcher task lists
- Mark task completion as researcher
- Confirm standalone task completion as admin
- Reject standalone task completion review as supervisor
- Confirm project-linked task completion as supervisor for supervised projects
- Reject project-linked task completion review as supervisor for non-supervised projects
- Show task completion requests in the Review Queue
- Disable standalone task delete action for supervisors
- Reject standalone task deletion by supervisors at the backend
- Allow supervisor task deletion only for supervised project-linked tasks

### Experiments

- Create experiment
- Link experiment to project
- Link experiment to researcher
- Link experiment to task
- Link experiment to protocol
- Edit experiment
- View experiment detail page
- Create, edit, delete, and filter notebook entries
- Approve experiment as admin
- Approve experiment as supervisor for supervised projects
- Reject experiment approval as supervisor for non-supervised projects
- Request changes with a required review note
- Show latest review comment to researchers
- Restrict experiment archiving by role

### Protocols

- Create protocol
- Link protocol to project
- Link protocol to equipment
- Save general SOPs without project linkage
- Edit protocol
- View protocol detail page
- Approve protocol as admin
- Approve project-linked protocol as supervisor for supervised projects
- Reject project-linked protocol approval as supervisor for non-supervised projects
- Approve general non-project-linked protocol as supervisor
- Request changes with a required review note
- Track approved by and approved date
- View protocols as researcher
- Restrict protocol management and archiving by role
- Reject researcher general SOP creation and editing
- Allow supervisor general SOP management
- Restrict supervisor project-linked protocol archiving to supervised projects

### Equipment

- Create equipment
- Edit equipment
- View equipment detail page
- View upcoming and past bookings
- View linked equipment SOPs
- Restrict equipment inventory management by role

### Equipment Bookings

- Create booking
- Edit booking
- Prevent overlapping confirmed bookings
- Allow non-overlapping bookings
- Allow cancelled bookings not to block new confirmed bookings
- Restrict booking deletion by role

### Review Queue

- View pending experiments
- View experiments with changes requested
- View pending protocols
- View protocols with changes requested
- Approve experiments from the queue
- Approve protocols from the queue
- Restrict review queue access to admin and supervisor users
- View task completion requests
- Open task completion request from Review Queue
- Confirm done from task detail page
- Reopen task from task detail page

### Dashboard

- Equipment total updates
- Equipment in use now updates
- Equipment offline updates
- Open tasks update
- Overdue tasks update
- Upcoming bookings update
- Pending protocols update
- Experiments needing review update
- Recent notebook entries update
- Review attention card links to the review queue
- Researcher dashboard shows assigned tasks
- Researcher dashboard includes standalone assigned tasks
- Researcher dashboard scopes project-linked data to member projects
- Admin dashboard shows global metrics
- Supervisor dashboard shows metrics scoped to supervised projects
- Tasks awaiting completion review update

### Admin User Management

- View all users as admin
- Filter users by role
- Change another user's role
- Prevent an admin from changing their own role in the UI
- Reject invalid roles in the backend
- Restrict role changes to admin users

### Researcher Workflow Permissions

- Toggle researcher experiment permissions from the admin users page
- Toggle researcher protocol permissions from the admin users page
- Toggle the individual researcher review requirement
- Apply bulk experiment permission changes to all researchers
- Apply bulk protocol permission changes to all researchers
- Apply the review requirement to all researchers
- Show mixed bulk-control state when researcher settings differ
- Hide experiment create/edit actions when researcher permissions are disabled
- Hide protocol create/edit actions when researcher permissions are disabled
- Allow experiment create/edit actions when researcher permissions are enabled
- Allow protocol create/edit actions when researcher permissions are enabled
- Keep archive actions restricted to admins and supervisors
- Keep approve/request changes actions restricted to admins and supervisors
- Confirm backend rejects unauthorized experiment/protocol create and edit requests

### Attachments

- Upload project attachments as admin, assigned supervisor, project lead, and project member
- Restrict project viewers to view and download only
- Upload experiment attachments according to project contribution permissions
- Upload project-linked and standalone task attachments according to task access
- Allow assigned researchers to manage only their own task attachments
- Allow admins and supervisors to manage equipment documents
- Restrict researchers to view and download equipment documents
- Support project-linked and general protocol attachment permissions
- Edit attachment category and description
- Download files using signed URLs
- Archive files and remove them from normal attachment lists
- Filter attachment lists by category
- Confirm cross-organization and unauthorized target access is rejected

---

## Automated Backend Test Coverage

LabFlow includes an automated backend test suite using Jest and Supertest.

The backend test suite includes comprehensive Jest and Supertest coverage for authentication, authorization, researcher review-policy behavior, review workflows, audit logs, archive and recovery behavior, attachments, equipment booking conflicts, organization isolation, workspace registration, invitation onboarding, email delivery, delivery tracking, resend, token invalidation, and transactional rollback.

Covered backend areas include:

- API health check
- Authentication login success and failure
- Authenticated `/api/auth/me` behavior
- Protected route access without a token
- Role-based authorization for user role updates
- Equipment booking conflict prevention
- Back-to-back equipment booking behavior
- Cancelled booking conflict behavior
- Task completion request workflow
- Admin confirmation of standalone task completion
- Supervisor-scoped project task completion review
- Experiment approval and change request workflows
- Protocol approval and change request workflows
- Admin updates to researcher review requirements
- Review-required and review-exempt experiment creation
- Review-required and review-exempt protocol creation
- Required review comments when requesting changes
- Review history event creation
- Project membership-aware project visibility
- Supervisor-scoped project visibility
- Project lead, viewer, and non-member task creation rules
- Cross-organization isolation for projects, tasks, and audit logs
- Invitation onboarding and revoke behavior
- Organization settings view/update behavior
- Admin-only organization updates
- Organization settings audit log creation
- Workspace registration
- First-administrator creation
- Organization slug generation
- Unsupported organization type rejection
- Client-supplied role and organization field protection
- Global email uniqueness
- Invitation acceptance rollback
- Invitation token reuse protection
- Admin-only archived-item listing
- Archived-item search, date filtering, and pagination
- Project, task, experiment, and protocol restoration
- Attachment restoration with R2 verification
- Parent-first restoration constraints
- Non-cascading restoration behavior
- Idempotent restoration
- Transactional restoration audit logging
- Cross-organization restoration isolation
- Cross-entity restoration workflows
- Invitation email configuration and provider selection
- HTML and plain-text invitation template generation
- Successful, failed, and skipped email delivery tracking
- Provider failure without invitation loss
- Invitation resend authorization and organization isolation
- Old-token invalidation and new-token acceptance
- Accepted and revoked invitation resend restrictions
- Production-safe raw-link behavior

Run backend tests from the backend folder:

```bash
npm test
```

The tests should be run against a dedicated test database, not the live demo database.

---

## Important Business Logic

### Equipment Booking Conflict Prevention

LabFlow prevents two confirmed bookings from overlapping for the same piece of equipment.

The overlap rule is:

```txt
existing.startTime < newEndTime
AND
existing.endTime > newStartTime
```

This means:

- 09:00 to 11:00 conflicts with 10:00 to 12:00
- 09:00 to 11:00 does not conflict with 11:00 to 12:00
- Cancelled bookings do not block new confirmed bookings

This logic is handled in the backend, not only in the frontend.

### Review Notes

When a supervisor or admin requests changes on an experiment or protocol, a review note is required. The latest review comment is shown on the detail page so researchers can see what needs to be corrected, clarified, repeated, or improved.

LabFlow stores the latest review comment on the reviewed record for quick visibility and also records approval and change-request decisions in review history events.

### Task Completion Review

Researchers can mark assigned tasks as ready for completion review. This changes the task status to Completion Requested instead of directly marking the task as Done.

Admins can confirm or reopen any task completion request, including standalone tasks. Supervisors can confirm or reopen project-linked task completion requests only for projects they supervise. Standalone task completion review is reserved for admins.

---

## Current Limitations

LabFlow MVP Version 1.5 is intentionally focused on core workflows.

Current limitations include:

- The generated Vercel demo hostname is currently classified as phishing by Kaspersky's reputation database. A Kaspersky reanalysis request is needed, and a stable custom domain is planned.
- Organization ownership, backend isolation, public workspace creation, invitation onboarding, and basic organization settings are included, but multi-organization memberships, organization switching, billing, subscription management, custom domains, and full institutional tenant administration are not yet implemented.
- Invitation email delivery is implemented and verified locally, but production Mailgun delivery still requires deployment configuration and verification. Email verification, self-service password reset, overdue-task notifications, booking reminders, and broader notification preferences are not yet included.
- Local Mailgun keys should not currently be stored in the local `.env` file because repeated automated key disabling was observed. Production secrets should be stored in Render, and local keys should be injected at process startup or loaded from an operating-system secret store.
- Dashboard project-linked metrics are role-aware, but equipment inventory remains organization-wide because equipment is not project-owned.
- Audit logging exists for important admin, review, restore, invitation, and delivery-related actions, but it is not immutable and does not yet include export, retention policies, signatures, or locked review controls.
- Archive and recovery cover projects, tasks, experiments, protocols, and attachments. Equipment, bookings, notebook entries, and project memberships retain their existing lifecycle behavior.
- Restoration is intentionally parent-first and non-cascading, so related records must be restored individually.
- PostgreSQL restoration and Cloudflare R2 verification cannot participate in one distributed transaction.
- Attachment malware scanning, content inspection, large multipart uploads, organization storage quotas, and physical deletion policies are not yet included.
- Notebook entries use plain text and do not yet support rich text or PDF export.
- Frontend automated tests are not yet included.
- Production-grade monitoring, centralized logging, account lockout, and automated deployment/migration orchestration are not yet complete.
- User email addresses are globally unique, so one account cannot currently belong to multiple organizations.
- Demo accounts use shared credentials and are not suitable for real production use.

---

## Portfolio Summary

LabFlow is a full-stack laboratory project management application built with React, Node.js, Express, PostgreSQL, Sequelize, and Ant Design.

The project demonstrates:

- Full-stack CRUD application architecture
- JWT authentication and protected routes
- Role-based access control
- Project membership and permission-aware data access
- Research workflow modeling for tasks, experiments, protocols, equipment, bookings, and review history
- Backend validation for equipment booking conflict prevention
- Deployment using Vercel, Render, and Neon PostgreSQL
- Practical domain modeling based on university research laboratory workflows
- Backend automated testing with Jest and Supertest

LabFlow was built as a portfolio project to demonstrate applied software development in a real-world scientific workflow domain.

---

## Future Improvements

Recommended Version 2 improvements:

- Stable custom frontend and API domains
- Kaspersky and other reputation-service reclassification for the production hostname
- Expanded organization administration, including logos, addresses, contacts, organization administrators, and tenant policies
- Multi-organization memberships and organization switching
- Subscription and billing support
- Email verification and self-service password reset
- Notification preferences, overdue-task alerts, booking reminders, and review notifications
- Secure local secret storage through Windows Credential Manager or PowerShell SecretManagement
- Production monitoring, centralized logging, alerting, and automated migration/deployment workflows
- More granular project-specific permissions and supervisor assignment rules
- Project invitation and membership approval workflows
- Equipment access rules for organization-wide, project-specific, or restricted instruments
- Immutable audit controls, audit export, signatures, and locked review history
- Rich-text notebook entries and experiment notebook PDF export
- Equipment maintenance history and calendar-based booking views
- Frontend component and workflow tests
- Attachment previews, malware scanning, file-content inspection, retention policies, storage quotas, and multipart uploads
- Read-only archived-record detail views before restoration
- Delegated archive-recovery permissions where appropriate
- Workspace ownership transfer and additional organization-administrator workflows

---

## Portfolio Notes

LabFlow demonstrates practical full-stack application development with a real-world domain use case.

Key portfolio talking points:

- Designed a relational PostgreSQL schema for a research lab workflow
- Built an Express API with protected routes and role-based access control
- Implemented JWT authentication and password hashing
- Created reusable frontend API modules with Axios
- Built data-heavy UI pages using Ant Design
- Implemented equipment booking conflict prevention
- Added a backend dashboard summary endpoint
- Built detail pages for connected lab workflows
- Added experiment-linked notebook entries
- Added a review queue with approval workflow
- Added required review notes for change requests
- Supported project protocols, equipment SOPs, and general SOPs
- Created seed data for realistic demo workflows
- Manually regression-tested the MVP
- Added project membership modeling for project-specific access control
- Implemented membership-aware project visibility for researcher users
- Combined role-based access, workflow permissions, and project membership checks
- Locked project linkage after record creation to prevent accidental access loss
- Added role-aware dashboard filtering for researcher users
- Updated task model to support standalone and project-linked lab work
- Added task completion request workflow with Review Queue visibility
- Added assignment-aware task visibility for researchers
- Scoped supervisor access to supervised projects
- Enforced supervisor-scoped review actions on the backend
- Updated Review Queue and dashboard visibility for supervisor-scoped workflows

---

## License

This project is currently intended for personal portfolio and educational use.
