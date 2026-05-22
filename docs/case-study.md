# LabFlow Case Study

## Overview

LabFlow is a full-stack project management application for university research laboratories. It helps lab teams manage projects, tasks, experiments, protocols, shared equipment, and equipment bookings in one centralized system.

## Problem

Research labs often rely on disconnected tools such as spreadsheets, email, shared drives, paper notes, and calendar apps. This makes it difficult to track project progress, assign tasks, review experiments, approve protocols, and prevent equipment booking conflicts.

## Solution

LabFlow centralizes key lab workflows into one application:

- Project management
- Task assignment
- Experiment tracking
- Protocol approval
- Equipment inventory
- Equipment booking
- Dashboard metrics

## My Role

I designed and built the full-stack MVP, including:

- Database schema
- Backend API
- Authentication
- Role-based access control
- Frontend UI
- Dashboard
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

LabFlow uses PostgreSQL with Sequelize associations between users, projects, tasks, experiments, protocols, equipment, and bookings.

### Authentication and Authorization

The app uses JWT authentication with role-based access control for admin, supervisor, and researcher users.

### Equipment Booking Conflict Prevention

The backend prevents overlapping confirmed equipment bookings using this rule:

```txt
existing.startTime < newEndTime
AND
existing.endTime > newStartTime

```

This ensures shared instruments cannot be double-booked.

**Dashboard Summary Endpoint**

The dashboard uses a backend summary endpoint to calculate key metrics such as active projects, open tasks, overdue tasks, experiments needing review, pending protocols, equipment in use, and upcoming bookings.

**Challenges**

One challenge was distinguishing between equipment that is offline because of its inventory status and equipment that is temporarily in use because of an active booking. I solved this by separating dashboard metrics into Equipment Offline and Equipment In Use Now.

Another challenge was preventing overlapping bookings reliably at the backend level instead of relying only on frontend validation.

**Result**

LabFlow MVP Version 1 includes a working full-stack workflow from authentication to dashboard reporting. The app includes seeded demo data and screenshots for portfolio presentation.

**Future Improvements**

Project membership system
Lab organization model
Role-specific dashboards
Admin user management
Audit logs
File uploads
Equipment maintenance history
Calendar view
Email notifications
Automated tests
Deployment
