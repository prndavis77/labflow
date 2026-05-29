# LabFlow Case Study

## Overview

LabFlow is a full-stack project management application for university research laboratories. It helps lab teams manage projects, tasks, experiments, protocols, shared equipment, equipment bookings, review workflows, and experiment-linked notebook entries in one centralized system.

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
- Task assignment
- Experiment tracking
- Experiment-linked notebook entries
- Protocol approval
- Equipment inventory
- Equipment booking with conflict prevention
- Review queue for supervisor/admin workflows
- Required review notes for change requests
- Dashboard metrics

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

### Equipment Booking Conflict Prevention

The backend prevents overlapping confirmed equipment bookings using this rule:

```txt
existing.startTime < newEndTime
AND
existing.endTime > newStartTime
```

This ensures shared instruments cannot be double-booked.

### Review Queue and Review Notes

LabFlow includes a review queue for supervisor/admin workflows. Experiments and protocols can be approved or sent back with required review notes. Review notes help researchers understand what needs to be corrected before approval.

The Review Queue helps supervisors find review work quickly, while detail pages provide the full context needed to approve or request changes.

### Experiment-Linked Notebook Entries

Experiments include notebook entries for procedures, observations, results, issues, conclusions, supervisor comments, and general notes. Notebook entries are linked to experiments and projects, allowing experiment detail pages, project detail pages, and the dashboard to show recent research activity.

### Equipment-Specific SOPs

Protocols can exist without a project and may be linked directly to equipment. This supports general lab SOPs and instrument-specific procedures such as startup, shutdown, tuning, or maintenance workflows.

### Dashboard Summary Endpoint

The dashboard uses a backend summary endpoint to calculate key metrics such as active projects, open tasks, overdue tasks, experiments needing review, pending protocols, equipment in use, equipment offline, upcoming bookings, and recent notebook entries.

### Cross-Linked Detail Pages

LabFlow includes detail pages for projects, tasks, experiments, protocols, and equipment. Related records link to each other so users can move through the workflow naturally.

Examples:

- Project to tasks
- Project to experiments
- Experiment to notebook entries
- Experiment to protocol
- Equipment to bookings
- Equipment to SOPs
- Review Queue to experiment/protocol detail pages

## Challenges

One challenge was distinguishing between equipment that is offline because of its inventory status and equipment that is temporarily in use because of an active booking. I solved this by separating dashboard metrics into Equipment Offline and Equipment In Use Now.

Another challenge was preventing overlapping bookings reliably at the backend level instead of relying only on frontend validation. I implemented the conflict check in the backend so the rule is enforced regardless of where the request comes from.

Another challenge was modeling protocols flexibly. Some protocols belong to a project, while others are general lab SOPs or equipment-specific SOPs. I updated the data model so protocols can optionally link to projects and equipment.

A later workflow challenge was handling review feedback. A simple status field was not enough because researchers need to know why changes were requested. I added required review notes for change requests while keeping the current version limited to the latest review comment.

## Result

LabFlow MVP Version 1.1 includes a working full-stack workflow from authentication to dashboard reporting, project tracking, task assignment, experiment documentation, protocol review, equipment booking, and experiment-linked notebook entries.

The app includes seeded demo data, screenshots, a detailed README, and a case study for portfolio presentation.

## Current Limitations

- Review comments currently store only the latest comment, not a full review history
- Notebook entries currently use plain text, not rich text
- No file attachments or image uploads yet
- No PDF export for experiment notebooks yet
- No production deployment setup yet
- No automated test suite yet
- No lab organization or project membership system yet

## Future Improvements

- Project membership system
- Lab organization model
- Role-specific dashboards
- Admin user management
- Full review history instead of only latest review comment
- Rich text editor for notebook entries
- File attachments and image uploads
- Experiment notebook PDF export
- Equipment maintenance history
- Calendar view for equipment bookings
- Email notifications
- Automated tests
- Deployment
