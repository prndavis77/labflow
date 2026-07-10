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

LabFlow MVP Version 1.2 is complete and deployed as a portfolio/demo application.

This version includes authentication, role-based access control, admin user management, configurable researcher workflow permissions, project membership, membership-aware project access, role-aware dashboard filtering, standalone and project-linked task management, task completion review, experiment tracking, protocol management, equipment inventory, equipment booking with conflict prevention, dashboard metrics, review history, experiment-linked notebook entries, and demo seed data.

The backend includes Sequelize migrations, security hardening, audit logging, archive behavior for core lab records, and 83 passing automated backend tests across 11 test suites.

The deployed demo uses a hosted PostgreSQL database and shared demo accounts for testing.

### Phase 20B: Soft Delete / Archive

Completed:

- Added archive fields to projects, tasks, experiments, and protocols.
- Replaced hard delete behavior with archive behavior for tasks.
- Replaced hard delete behavior with archive behavior for experiments.
- Replaced hard delete behavior with archive behavior for protocols.
- Replaced hard delete behavior with archive behavior for projects.
- Updated frontend delete wording to archive wording.
- Added backend tests for archive behavior.

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

- User registration
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
- Can view available protocols
- Can create and update protocols when workflow permissions and project membership allow it
- Cannot approve experiments or protocols
- Cannot request review changes
- Cannot manage equipment inventory
- Cannot delete protected records

Researcher workflow permissions allow admins to support different lab supervision styles. Some labs may allow researchers to independently create experiments and protocols, while other labs may require supervisor control over those workflows.

Public registration creates researcher accounts only. Admin and supervisor accounts should be created through development tools or a future admin user-management workflow.

### Archive / Soft Delete

LabFlow now uses archive behavior for core lab records instead of permanent deletion. Projects, tasks, experiments, and protocols can be archived by authorized users. Archived records are hidden from normal lists but remain in the database for traceability and audit purposes.

Archive actions are recorded in the audit log, including the actor, target record, timestamp, and relevant metadata.

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

---

## Researcher Workflow Permissions

LabFlow includes configurable workflow permissions for researcher accounts.

Admins can control whether each researcher can:

- Create experiments
- Edit experiments
- Create protocols
- Edit protocols

Admins have global workflow access. Supervisors have workflow access scoped to projects where they are assigned as the project supervisor. Researcher permissions provide finer control for labs with different supervision styles.

For example, one researcher may be allowed to independently create and edit experiments but not protocols. Another researcher may be allowed to create and edit protocols but not experiments. A third researcher may be allowed to create and edit both.

Researchers still cannot approve experiments, approve protocols, request review changes, or delete protected experiment/protocol records.

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

## MVP Version 1.2 Features

- Experiment-linked notebook entries
- Review Queue for supervisor/admin review workflows
- Review actions for experiments and protocols
- Review history for experiment and protocol review decisions
- Required review notes when requesting changes
- Admin user management
- Admin-controlled role changes
- Configurable researcher workflow permissions
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
- Archive behavior for projects, tasks, experiments, and protocols, replacing permanent deletion for core lab records.
- Role-based access control for admins, supervisors, and researchers
- Organization-scoped lab workspaces
- Admin-created invitations
- Secure invitation acceptance flow
- Visible active lab/workspace context in the UI
- Project, task, experiment, protocol, equipment, booking, notebook, review, archive, and audit-log workflows
- Organization settings page for admins
- Editable organization name and type
- Invitation list management with status, expiration, invited-by, and accepted-date details
- Pending invitation revoke action
- Backend test coverage with 83 passing tests across 11 test suites

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
- Configure researcher workflow permissions
- View account creation and update dates

The interface prevents admins from changing their own role from the admin users page. The backend also protects role updates and permission updates so only admin users can perform those actions.

Workflow permission controls are shown for researcher accounts. Admin and supervisor accounts show full access by role.

### Invitation-Based Onboarding

Admins can invite users into their organization instead of relying only on public registration.

The invitation flow includes:

1. Admin creates an invitation with name, email, role, optional department, and researcher permissions.
2. LabFlow generates a secure invitation link.
3. The invitation token is hashed before storage.
4. The invited user opens the link and sets a password.
5. LabFlow creates the user inside the correct organization.
6. The invitation is marked as accepted and cannot be reused.

For the MVP, invitation links are shown directly in the admin UI instead of being sent by email.

Admins can view an invitation list showing invitee name, email, role, department, status, expiration date, invited date, invited-by information, and accepted date. Pending invitations can be revoked from the admin interface.

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
- Configurable researcher workflow permissions
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
- Organization-based data ownership and backend query scoping
- Cross-organization isolation tests for projects, tasks, and audit logs

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
        database.js
        sequelize-cli.js
      constants/
        roles.js
      controllers/
        auditLogController.js
        authController.js
        dashboardController.js
        equipmentBookingController.js
        equipmentController.js
        experimentController.js
        invitationController.js
        notebookEntryController.js
        projectController.js
        projectMemberController.js
        protocolController.js
        taskController.js
        userController.js
      middleware/
        authMiddleware.js
      migrations/
        20260622122950-initial-labflow-schema.js
      models/
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
        auditLogRoutes.js
        authRoutes.js
        dashboardRoutes.js
        equipmentBookingRoutes.js
        equipmentRoutes.js
        experimentRoutes.js
        invitationRoutes.js
        notebookEntryRoutes.js
        projectRoutes.js
        projectMemberRoutes.js
        protocolRoutes.js
        taskRoutes.js
        userRoutes.js
      scripts/
        seedDemoData.js
      seeders/
      tests/
        helpers/
          testHelpers.js
      utils/
        dateUtils.js
        formatUserResponse.js
        generateToken.js
        projectAccess.js
      server.js

  labflow-frontend/
    src/
      api/
        authApi.js
        dashboardApi.js
        equipmentApi.js
        equipmentBookingApi.js
        experimentApi.js
        invitationApi.js
        notebookEntryApi.js
        projectApi.js
        projectMemberApi.js
        protocolApi.js
        taskApi.js
        userApi.js
        axiosClient.js
      components/
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
          InviteUserModal.jsx
        ScrollToTop.jsx
      constants/
        statusColors.js
        statusOptions.js
      context/
        AuthContext.jsx
      layouts/
      pages/
        AcceptInvitePage.jsx
        AdminUsersPage.jsx
        DashboardPage.jsx
        EquipmentDetailPage.jsx
        EquipmentPage.jsx
        ExperimentDetailPage.jsx
        ExperimentsPage.jsx
        LoginPage.jsx
        NotFoundPage.jsx
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
      utils/
        formatters.js
      App.jsx
      main.jsx

```

## Database Models

LabFlow MVP Version 1.2 includes the following main models.

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

## Security and Deployment Notes

LabFlow is currently prepared for portfolio/demo deployment. It should not be used with real laboratory or research data without additional production hardening.

Production environment variables should be stored only in the hosting provider's environment variable settings. Do not commit real `.env` files, database URLs, JWT secrets, or production credentials to Git.

LabFlow includes basic backend hardening for the demo API, including security headers with Helmet, authentication rate limiting, restricted CORS origins, JWT authentication, password hashing, protected routes, role-based authorization, and project-scoped backend access checks.

Public registration creates researcher accounts only. Admin and supervisor users should be created through controlled seed data or a future admin-only workflow.

The included demo seed data uses shared demo credentials for portfolio testing. These credentials are not suitable for real production use.

The `npm run seed` command is intended for local and demo setup only. It clears existing demo data and replaces it with seeded test data. It should not be run against a real production database with customer or research records.

LabFlow now includes a Sequelize migration baseline for the current MVP schema. New databases should be initialized with migrations instead of relying on Sequelize schema sync.

The `npm run setup:db` command is kept only as a legacy/demo fallback from the original MVP deployment path. It uses Sequelize schema sync and should not be run casually against a live database containing real user data.

Before LabFlow is used as real production software, additional hardening would still be required, including email verification, centralized logging, monitoring, stricter secrets management, account lockout rules, organization-level tenant isolation, immutable audit controls, and a more complete production deployment process.

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
```

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

The seed script is intended for local and portfolio/demo setup only. It clears existing demo data and replaces it with seeded test records.

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

Warning: the seed script clears existing data and replaces it with demo data. It is intended for local and portfolio/demo setup only. Do not run `npm run seed` against a real production database containing customer, laboratory, or research records.

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

## Manual Regression Test Coverage

LabFlow MVP Version 1.2 was manually tested across the following workflows:

### Authentication

- Register new researcher
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
- Hide experiment create/edit actions when researcher permissions are disabled
- Hide protocol create/edit actions when researcher permissions are disabled
- Allow experiment create/edit actions when researcher permissions are enabled
- Allow protocol create/edit actions when researcher permissions are enabled
- Keep archive actions restricted to admins and supervisors
- Keep approve/request changes actions restricted to admins and supervisors
- Confirm backend rejects unauthorized experiment/protocol create and edit requests

---

## Automated Backend Test Coverage

LabFlow includes an automated backend test suite using Jest and Supertest.

The backend test suite currently includes 11 passing test suites and 83 passing tests, including authorization, review workflows, audit logs, soft archive behavior, equipment booking conflicts, organization isolation, invitation onboarding, and organization settings.

Current backend test status: 11 test suites, 83 tests passing.

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

LabFlow MVP Version 1.2 is intentionally focused on core workflows.

Current limitations include:

- Organization-level data ownership, backend scoping, admin-created invitations, and basic organization settings are now included, but LabFlow does not yet include complete multi-organization tenant administration workflows.
- Dashboard project-linked metrics are role-aware for researchers, but equipment inventory metrics are still global because equipment is not project-owned yet.
- No file uploads
- No email notifications
- Audit logging exists for important admin and review workflow actions, but it is not yet immutable and does not yet include export, retention policies, or signed review controls.
- Archive behavior exists for core lab records, but equipment, bookings, notebook entries, and project memberships still use their existing delete/remove workflows.
- No drag-and-drop calendar
- Portfolio/demo deployment is live, but LabFlow does not yet include full production-grade deployment automation.
- Backend automated tests now cover core API workflows, but frontend automated tests are not yet included.
- Notebook entries currently use plain text, not rich text
- No file attachments or image uploads for notebook entries
- No PDF export for experiment notebooks
- Review history exists, but it currently stores review events only. It does not yet include file attachments, signed approvals, or immutable audit controls.
- Researcher workflow permissions are still global per user, while project membership controls project access separately
- User management supports account deactivation/reactivation, admin password reset, and invitation-based onboarding, but does not yet include email verification or self-service password reset.
- Supervisor access is project-scoped within the user's organization, and admin-created invitations are supported, but LabFlow does not yet include full organization administration workflows.
- Project member roles now control core project-linked contribution behavior, but more granular project-specific permissions are still planned for future versions.
- Project membership is not yet connected to notifications or invitations
- Sequelize migrations are now available for the current MVP schema, but automated production deployment and migration workflows still need further hardening.
- Basic security headers, authentication rate limiting, and organization-level backend isolation are included, but production-grade monitoring, account lockout, email verification, immutable audit controls, and advanced tenant administration controls are not yet implemented.
- Demo accounts use shared demo credentials and are not suitable for real production use.

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

- Expanded organization administration, including logo, address, contact details, organization admins, and tenant-level policies
- Email delivery for invitation links
- Invitation management improvements, such as resend and expiration controls
- Role-specific dashboards
- More granular project membership permissions with project-specific workflow controls
- Archive restore workflows and admin views for archived records
- Immutable audit controls for research history
- Stronger review/audit controls for signed or locked review history
- Rich text notebook entries
- File attachments and image uploads for notebook entries
- PDF export for experiment notebooks
- File uploads for experiment data and protocols
- Equipment maintenance logs
- Calendar view for equipment bookings
- Notifications for overdue tasks and upcoming bookings
- PDF or CSV export
- Additional backend test coverage for remaining edge cases
- Frontend component and workflow tests
- Production deployment automation and migration-based database setup
- Self-service password reset and email verification
- More granular supervisor assignment rules beyond the current project supervisor ownership model
- Project invitations and membership approval workflow
- Project-specific workflow permissions
- Equipment access model for lab-wide, project-specific, or restricted instruments
- Task completion notes or admin feedback when reopening tasks
- Expanded tenant administration workflows, including organization settings, invitations, and organization-level roles

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
