# LabFlow Case Study

## Overview

LabFlow is a full-stack project management application for university research laboratories. It helps lab teams manage projects, standalone and project-linked tasks, experiments, protocols, shared equipment, equipment bookings, review workflows, and experiment-linked notebook entries in one centralized system.

## Problem

Research labs often rely on disconnected tools such as spreadsheets, email, shared drives, paper notes, and calendar apps. This makes it difficult to track project progress, assign tasks, document experiments, review protocols, manage shared instruments, and prevent equipment booking conflicts.

Common questions can become harder than they should be:

- Which experiments need review?
- Which protocols are approved?
- Which equipment is currently in use?
- Which project does a booking belong to?
- What feedback did a supervisor leave on a rejected experiment or protocol?
- Where are the experiment notes and observations stored?

## Solution

LabFlow centralizes key lab workflows into one application:

- Project management
- Standalone and project-linked task assignment
- Experiment tracking
- Experiment-linked notebook entries
- Protocol approval
- Equipment inventory
- Equipment booking with conflict prevention
- Review queue for supervisor/admin workflows
- Required review notes for change requests
- Dashboard metrics
- Admin user management
- Configurable researcher workflow permissions
- Permission-aware experiment and protocol workflows
- Project membership
- Membership-aware project access
- Project-specific member roles
- Standalone and project-linked task management
- Assignment-aware researcher task visibility
- Task completion request workflow
- Task completion requests in the Review Queue
- Role-aware dashboard filtering

## My Role

I designed and built the full-stack MVP, including:

- Database schema
- Backend API
- Authentication
- Role-based access control
- Frontend UI
- Dashboard
- Review workflow
- Experiment notebook workflow
- Demo seed data
- Manual regression testing
- Admin user management workflow
- Researcher permission controls
- Reusable form modal refactor
- Project membership model
- Membership-aware backend access rules
- Project members UI on project detail pages
- Role-aware dashboard filtering
- Standalone and project-linked task model
- Assignment-aware task access rules
- Task completion request workflow
- Review Queue task completion integration

## Tech Stack

- React
- Vite
- Ant Design
- Node.js
- Express
- PostgreSQL
- Sequelize
- JWT
- bcrypt

## Key Technical Features

### Relational Database Design

LabFlow uses PostgreSQL with Sequelize associations between users, projects, tasks, experiments, protocols, equipment, equipment bookings, and notebook entries.

### Authentication and Authorization

The app uses JWT authentication with role-based access control for admin, supervisor, and researcher users. Public registration creates researcher accounts only, while admin and supervisor accounts are reserved for controlled setup or future admin workflows.

### Admin User Management and Researcher Permissions

LabFlow includes an admin-only user management page where admins can view users, change user roles, and configure researcher workflow permissions.

Researcher permissions allow admins to decide whether individual researchers can independently create or edit experiments and protocols. This supports different lab supervision styles, from tightly controlled labs to more independent research environments.

The frontend uses these permission flags to hide create and edit actions when a researcher does not have access. Backend authorization still enforces the same rules, so the permission system does not rely only on hidden buttons.

### Project Membership and Membership-Aware Access

LabFlow includes a project membership system that links users to specific projects with project-level roles such as lead, member, and viewer.

This adds a project-level access layer on top of system roles and researcher workflow permissions. Researchers can only view projects where they are members. For experiments and project-linked protocols, researchers must also have project access and the required workflow permissions. Tasks use an assignment-aware access model, so researchers can see tasks assigned to them, including standalone tasks without a project link.

The backend enforces membership-aware access for project detail views and project-linked experiment and protocol workflows. Task access is enforced separately through assignment-aware rules and locked project linkage.

### Locked Project Linkage

Experiments must be linked to a project, while protocols may be project-linked or saved as general SOPs. Tasks may be standalone or project-linked depending on the lab work being assigned.

When a task, experiment, or protocol is created with a project link, that project link is locked in normal edit workflows. This prevents users from accidentally moving a record to a project they cannot access, which could cause them to lose the ability to correct the mistake.

### Standalone Tasks and Task Completion Review

LabFlow supports both project-linked tasks and standalone lab tasks. This reflects real lab work where tasks may involve shared equipment, freezer restocking, instrument tuning, column changes, or general assistance that does not belong directly to one research project.

Researcher task visibility is assignment-aware. Researchers see tasks assigned to them, including standalone tasks without a project link. When a researcher finishes a task, they can mark it as ready for completion review instead of directly marking it as done.

Admins and supervisors can confirm the task as done or reopen it from the task detail page. Completion-requested tasks also appear in the Review Queue so supervisors have one place to find experiments, protocols, and tasks needing attention.

### Reusable Experiment and Protocol Modals

Experiment and protocol create/edit forms were refactored into reusable modal components. This allows the list pages and detail pages to share the same form logic.

Users can edit experiments and protocols directly from detail pages without navigating away, while the list pages still use the same modal components for create and edit workflows.

### Equipment Booking Conflict Prevention

The backend prevents overlapping confirmed equipment bookings using this rule:

```txt
existing.startTime < newEndTime
AND
existing.endTime > newStartTime
```

This ensures shared instruments cannot be double-booked.

### Review Queue, Review Notes, and Review History

LabFlow includes a review queue for supervisor/admin workflows. Experiments and protocols can be approved or sent back with required review notes. The Review Queue also shows task completion requests so admins and supervisors can review completed task submissions.

The app stores the latest review feedback on the reviewed record for quick visibility and also records review events in a separate review history table. This preserves repeated review cycles such as changes requested, revised, more changes requested, and approved.

The Review Queue helps supervisors find review work quickly, while detail pages provide the full context needed to approve experiments, approve protocols, request changes, confirm task completion, or reopen tasks.

### Experiment-Linked Notebook Entries

Experiments include notebook entries for procedures, observations, results, issues, conclusions, supervisor comments, and general notes. Notebook entries are linked to experiments and projects, allowing experiment detail pages, project detail pages, and the dashboard to show recent research activity.

### Equipment-Specific SOPs

Protocols can exist without a project and may be linked directly to equipment. This supports general lab SOPs and instrument-specific procedures such as startup, shutdown, tuning, or maintenance workflows.

### Dashboard Summary Endpoint

The dashboard uses a backend summary endpoint to calculate key metrics such as active projects, open tasks, overdue tasks, task completion requests, experiments needing review, pending protocols, equipment in use, equipment offline, upcoming bookings, and recent notebook entries.

The dashboard is role-aware. Admins and supervisors see global MVP dashboard data, while researchers see project-linked dashboard data only for projects where they are members. Researcher task summaries are assignment-aware, so their dashboard shows tasks assigned to them, including standalone tasks without a project link.

Equipment inventory metrics remain global in the current MVP because equipment is not project-owned yet.

### Cross-Linked Detail Pages

LabFlow includes detail pages for projects, tasks, experiments, protocols, and equipment. Related records link to each other so users can move through the workflow naturally.

Examples:

- Project to linked tasks
- Project to experiments
- Experiment to notebook entries
- Experiment to protocol
- Equipment to bookings
- Equipment to SOPs
- Review Queue to experiment/protocol detail pages
- Review Queue to task completion requests
- Task to related experiments

## Challenges

One challenge was distinguishing between equipment that is offline because of its inventory status and equipment that is temporarily in use because of an active booking. I solved this by separating dashboard metrics into Equipment Offline and Equipment In Use Now.

Another challenge was preventing overlapping bookings reliably at the backend level instead of relying only on frontend validation. I implemented the conflict check in the backend so the rule is enforced regardless of where the request comes from.

Another challenge was modeling protocols flexibly. Some protocols belong to a project, while others are general lab SOPs or equipment-specific SOPs. I updated the data model so protocols can optionally link to projects and equipment.

A later workflow challenge was handling review feedback. A simple status field was not enough because researchers need to know why changes were requested. I added required review notes for change requests while storing the latest review comment for quick visibility and recording review events for repeated review cycles.

Another challenge was balancing simple role-based access control with real lab supervision styles. Some supervisors want tight control over experiment and protocol creation, while others allow experienced researchers to work more independently. I solved this by keeping roles simple while adding configurable workflow permissions for researcher accounts.

A frontend architecture challenge appeared when experiment and protocol editing needed to work from both list pages and detail pages. I refactored the forms into reusable modal components so both page types could share the same create/edit logic.

Another challenge was introducing project membership without breaking existing workflows. I first added the membership model and UI, then added membership-aware access rules in a separate phase. This made it easier to test project visibility and project-linked record permissions step by step.

Another workflow challenge appeared when tasks became broader than project work. In a real lab, a researcher may be asked to tune an instrument, restock a freezer, change a column, or help another researcher without the task belonging directly to one project. I updated the task model so tasks can be standalone or project-linked, then adjusted researcher task visibility to be assignment-aware rather than only membership-aware.

A later access-control issue appeared when existing tasks, experiments, and protocols could be moved to another project. This could cause a researcher to lose access to a record after accidentally changing its project. I solved this by locking project linkage after creation and treating project reassignment as a future admin-level workflow.

A later dashboard challenge was making summary data respect user context. Project-linked dashboard records needed to be scoped by project membership for researchers, while task summaries needed to show assigned tasks rather than all tasks in member projects. I solved this by separating project-linked dashboard filters from task-specific dashboard filters.

Another workflow issue was that researchers needed a way to signal that assigned work was finished without directly marking it as done. I added a Completion Requested task status so researchers can submit completion requests, while admins and supervisors confirm done or reopen the task after review.

## Result

LabFlow MVP Version 1.1 includes a working full-stack workflow from authentication to role-aware dashboard reporting, project tracking, project membership, standalone and project-linked task management, task completion review, experiment documentation, protocol review, equipment booking, review history, and experiment-linked notebook entries.

The app includes seeded demo data, screenshots, a detailed README, and a case study for portfolio presentation.

## Current Limitations

- Notebook entries currently use plain text, not rich text
- No file attachments or image uploads yet
- No PDF export for experiment notebooks yet
- No production deployment setup yet
- No automated test suite yet
- No lab or organization model yet
- Review history exists, but it is not yet a locked audit trail with signatures or immutable event controls
- Researcher workflow permissions are global per user, not project-specific yet
- User management does not yet include account deactivation or password reset
- Project member roles exist, but lead/member/viewer behavior is not fully differentiated yet
- Supervisor access is still broad in the current MVP
- Project invitations and membership approval workflows are not implemented yet
- Task completion review currently does not include separate completion notes or reviewer feedback when a task is reopened
- Equipment inventory metrics are still global because equipment is not project-owned yet

## Future Improvements

- Lab organization model
- More advanced role-specific dashboards with role-specific layouts and recommended actions
- Stronger signed review/audit trail controls
- Rich text editor for notebook entries
- File attachments and image uploads
- Experiment notebook PDF export
- Equipment maintenance history
- Calendar view for equipment bookings
- Email notifications
- Automated tests
- Account deactivation workflow
- Admin invitation or password reset workflow
- More granular project member role permissions
- Supervisor access scoped to supervised or assigned projects
- Project invitation workflow
- Project-specific workflow permissions
- Task completion notes and reviewer feedback when reopening tasks
- Equipment access model for lab-wide, project-specific, or restricted instruments
- Deployment
