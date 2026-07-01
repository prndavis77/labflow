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
- Review queue for supervisor/admin workflows
- Required review notes for change requests
- Review history tracking
- Role-aware dashboard metrics
- Admin user management
- Configurable researcher workflow permissions
- Project membership and project-specific access rules

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

### Testing and Deployment

- Jest
- Supertest
- Vercel
- Render
- Neon PostgreSQL
- Git and GitHub

## Key Technical Features

### Relational Database Design

LabFlow uses a relational PostgreSQL schema modeled with Sequelize. The main entities include users, projects, project members, tasks, experiments, protocols, equipment, equipment bookings, notebook entries, and review events.

The data model is designed around connected lab workflows. Projects can have tasks, experiments, protocols, bookings, notebook entries, and project members. Experiments can link to projects, researchers, tasks, protocols, bookings, and notebook entries. Equipment can link to bookings and instrument-specific SOPs.

### Authentication and Authorization

The app uses JWT authentication with protected frontend routes and protected backend API routes.

LabFlow supports three main user roles:

- Admin
- Supervisor
- Researcher

Admins have global access across the demo workspace. Supervisors are scoped to projects where they are assigned as the project supervisor. Researchers access project-linked work through project membership and assignment-aware task rules.

The backend enforces authorization rules so users cannot bypass access restrictions by calling API endpoints directly.

### Project Membership and Layered Permissions

LabFlow uses a layered permission model:

- System role: admin, supervisor, or researcher
- Project role: lead, member, or viewer
- Researcher workflow permissions: create/edit experiments and protocols

This avoids giving researchers broad access just because they have a general permission flag. For example, a researcher may have permission to create protocols, but they can only create project-linked protocols for projects where they are a member and where their project role allows contribution.

Project viewers have read-only access to project-linked work. Project members can contribute when their workflow permissions allow it. Project leads can coordinate project-linked work.

### Researcher Workflow Permissions

Admins can configure whether each researcher can:

- Create experiments
- Edit experiments
- Create protocols
- Edit protocols

This supports different lab supervision styles. Some labs may allow experienced researchers to work independently, while others may require tighter supervisor control over experiments and protocols.

The frontend hides actions that a researcher should not use, while the backend still enforces the same rules for security.

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

Researchers can view available protocols, but general SOP management is restricted to admins and supervisors.

### Review Queue, Review Notes, and Review History

LabFlow includes a Review Queue for supervisor/admin review workflows. Experiments, protocols, and task completion requests can be surfaced for review.

When requesting changes on an experiment or protocol, reviewers must provide a review note. The latest review comment is shown on the record so researchers can see what needs to be corrected, clarified, repeated, or improved.

LabFlow also stores review history events. This preserves repeated review cycles such as changes requested, revised, more changes requested, and approved.

### Experiment-Linked Notebook Entries

Experiments include notebook entries for procedures, observations, results, issues, conclusions, supervisor comments, and general notes.

Notebook entries are linked to experiments and projects, allowing experiment detail pages, project detail pages, and the dashboard to show recent research activity.

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

The current test suite includes 59 passing tests across 8 test suites. Covered areas include:

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
- Review history event creation

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

Audit logging currently covers user role changes, workflow permission updates, account deactivation and reactivation, admin password resets, experiment review submissions and decisions, protocol review submissions and decisions, and task completion review requests and decisions.

Admins can review these events in a dedicated Audit Logs page with filters for action, entity type, actor name, and target user name.

### Soft Delete and Auditability

To support research-lab traceability, LabFlow avoids permanently deleting core lab records. Projects, tasks, experiments, and protocols are archived instead. This keeps historical records available for audit trails while removing inactive items from normal working views.

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

## Result

LabFlow MVP Version 1.1 is complete and deployed as a portfolio/demo application.

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
- 59 passing automated backend tests across 8 test suites
- Seeded demo data and demo accounts
- GitHub README and portfolio case study

## Current Limitations

LabFlow is intentionally focused on MVP workflows.

Current limitations include:

- No lab or organization model yet
- No file uploads
- No rich text editor for notebook entries
- No image attachments for experiment notebooks
- No PDF export for experiment notebooks
- No email notifications
- Audit logging exists for important admin and review workflow actions, but it is not yet immutable and does not yet include export, retention policies, or signed review controls.
- Account deactivation/reactivation exists, but there is no invitation-based onboarding yet.
- Admin password reset exists, but self-service password reset and email verification are not yet included.
- No frontend automated tests yet
- No production-grade monitoring or centralized logging
- No organization-level tenant isolation
- Equipment inventory metrics are still global because equipment is not project-owned yet
- Review history exists, but it is not yet a locked audit trail with signatures or immutable event controls

## Future Improvements

Recommended future improvements include:

- Lab organization model
- Multi-lab or tenant-aware data separation
- Rich text notebook entries
- File attachments and image uploads
- Experiment notebook PDF export
- Equipment maintenance history
- Calendar view for equipment bookings
- Email notifications
- Frontend component and workflow tests
- Immutable audit controls and audit export
- Email verification and self-service password reset
- Admin invitation workflow
- Project invitation workflow
- Project-specific workflow permissions
- Equipment access model for lab-wide, project-specific, or restricted instruments
- Production deployment automation and monitoring

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
