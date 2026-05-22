# LabFlow

LabFlow is a full-stack project management application designed for university research laboratories. It helps lab teams manage research projects, tasks, experiments, protocols, shared equipment, and equipment bookings in one centralized system.

The goal of LabFlow is to solve a common problem in academic labs: research work is often spread across email, spreadsheets, shared drives, paper notes, calendar tools, and informal messaging. LabFlow brings the most important workflows into one structured application.

## Project Status

LabFlow MVP Version 1 is complete.

This version includes authentication, role-based access control, project management, task assignment, experiment tracking, protocol management, equipment inventory, equipment booking with conflict prevention, dashboard metrics, and demo seed data.

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

#### Supervisor

- Can manage projects
- Can manage protocols
- Can manage equipment inventory
- Can manage equipment bookings
- Can review lab workflows

#### Researcher

- Can register publicly
- Can view projects
- Can create and update tasks
- Can create and update experiments
- Can view protocols
- Can view equipment
- Can create and update equipment bookings
- Cannot manage equipment inventory
- Cannot delete protected records

Public registration creates researcher accounts only. Admin and supervisor accounts should be created through development tools or a future admin user-management workflow.

---

## MVP Version 1 Features

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

The dashboard also includes summary tables for:

- Tasks due soon
- Experiments needing review
- Protocols pending review
- Upcoming equipment bookings
- Recent projects
- Recently updated tasks
- Recently updated experiments

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

### Tasks

Tasks are linked to projects and represent actionable research work.

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
- Review
- Done

Task priorities include:

- Low
- Medium
- High
- Urgent

### Experiments

Experiments represent lab activities connected to research projects.

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

### Protocols

Protocols represent reusable lab methods, SOPs, or experimental procedures.

Protocol records include:

- Title
- Version
- Purpose
- Content
- Approval status
- Project
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

---
## Screenshots

### Dashboard

![LabFlow dashboard showing project, task, experiment, protocol, and equipment metrics](docs/screenshots/dashboard.png)

### Projects

![LabFlow projects page showing research projects, statuses, supervisors, and timelines](docs/screenshots/projects.png)

### Tasks

![LabFlow tasks page showing assigned tasks, priorities, statuses, due dates, and linked projects](docs/screenshots/tasks.png)

### Experiments

![LabFlow experiments page showing project-linked experiments, researchers, review status, protocols, and tasks](docs/screenshots/experiments.png)

### Protocols

![LabFlow protocols page showing lab methods, versions, approval status, and approved-by data](docs/screenshots/protocols.png)

### Equipment Inventory

![LabFlow equipment inventory page showing lab instruments, locations, equipment types, and availability status](docs/screenshots/equipment-inventory.png)

### Equipment Bookings

![LabFlow equipment bookings page showing instrument reservations, users, time ranges, projects, and experiments](docs/screenshots/equipment-bookings.png)

### Booking Conflict Prevention

![LabFlow booking conflict error showing that overlapping confirmed equipment bookings are rejected](docs/screenshots/booking-conflict.png)

---

## Technical Highlights

LabFlow demonstrates several full-stack development concepts:

- React frontend with Vite
- Ant Design UI components
- Node.js and Express backend
- PostgreSQL relational database
- Sequelize ORM models and associations
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
- JWT
- bcrypt
- dotenv
- cors

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
      constants/
        roles.js
      controllers/
        authController.js
        dashboardController.js
        equipmentBookingController.js
        equipmentController.js
        experimentController.js
        projectController.js
        protocolController.js
        taskController.js
        userController.js
      middleware/
        authMiddleware.js
      models/
        Equipment.js
        EquipmentBooking.js
        Experiment.js
        Project.js
        Protocol.js
        Task.js
        User.js
        index.js
      routes/
        authRoutes.js
        dashboardRoutes.js
        equipmentBookingRoutes.js
        equipmentRoutes.js
        experimentRoutes.js
        projectRoutes.js
        protocolRoutes.js
        taskRoutes.js
        userRoutes.js
      scripts/
        seedDemoData.js
      utils/
        dateUtils.js
        formatUserResponse.js
        generateToken.js
      server.js

  labflow-frontend/
    src/
      api/
        authApi.js
        dashboardApi.js
        equipmentApi.js
        equipmentBookingApi.js
        experimentApi.js
        projectApi.js
        protocolApi.js
        taskApi.js
        userApi.js
        axiosClient.js
      components/
      constants/
        statusColors.js
        statusOptions.js
      context/
        AuthContext.jsx
      layouts/
      pages/
        DashboardPage.jsx
        EquipmentPage.jsx
        ExperimentsPage.jsx
        LoginPage.jsx
        NotFoundPage.jsx
        ProjectsPage.jsx
        ProtocolsPage.jsx
        RegisterPage.jsx
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

Database Models

LabFlow MVP Version 1 includes the following main models:

User

Stores authenticated users and their roles.

Relationships:

User can supervise many projects
User can be assigned many tasks
User can create many tasks
User can perform many experiments
User can create many experiments
User can create and approve protocols
User can create equipment bookings
Project

Represents a research project.

Relationships:

Project belongs to one supervisor
Project has many tasks
Project has many experiments
Project has many protocols
Project has many equipment bookings
Task

Represents a project-related action item.

Relationships:

Task belongs to one project
Task may be assigned to one user
Task is created by one user
Task may have related experiments
Experiment

Represents a lab activity or experimental run.

Relationships:

Experiment belongs to one project
Experiment belongs to one researcher
Experiment may be linked to one task
Experiment may use one protocol
Experiment may have equipment bookings
Protocol

Represents a reusable lab method or SOP.

Relationships:

Protocol belongs to one project
Protocol is created by one user
Protocol may be approved by one user
Protocol may be used by many experiments
Equipment

Represents a shared lab instrument.

Relationships:

Equipment has many bookings
EquipmentBooking

Represents a reserved equipment time slot.

Relationships:

Booking belongs to one equipment item
Booking belongs to one user
Booking may be linked to one project
Booking may be linked to one experiment
API Overview
Authentication
POST /api/auth/register
POST /api/auth/login
GET /api/auth/me
Users
GET /api/users
Dashboard
GET /api/dashboard/summary
Projects
GET /api/projects
GET /api/projects/:id
POST /api/projects
PATCH /api/projects/:id
DELETE /api/projects/:id
Tasks
GET /api/tasks
GET /api/tasks/:id
POST /api/tasks
PATCH /api/tasks/:id
DELETE /api/tasks/:id
Experiments
GET /api/experiments
GET /api/experiments/:id
POST /api/experiments
PATCH /api/experiments/:id
DELETE /api/experiments/:id
Protocols
GET /api/protocols
GET /api/protocols/:id
POST /api/protocols
PATCH /api/protocols/:id
DELETE /api/protocols/:id
Equipment
GET /api/equipment
GET /api/equipment/:id
POST /api/equipment
PATCH /api/equipment/:id
DELETE /api/equipment/:id
Equipment Bookings
GET /api/equipment-bookings
GET /api/equipment-bookings/:id
POST /api/equipment-bookings
PATCH /api/equipment-bookings/:id
DELETE /api/equipment-bookings/:id
Local Setup
Prerequisites

Make sure you have installed:

Node.js
npm
PostgreSQL
Git
Backend Setup

Navigate to the backend folder:

cd labflow-backend

Install dependencies:

npm install

Create a .env file:

PORT=5000
DATABASE_URL=postgres://postgres:your_password@localhost:5432/labflow_db
JWT_SECRET=replace_this_with_a_long_random_secret
NODE_ENV=development

Create the PostgreSQL database:

CREATE DATABASE labflow_db;

Start the backend:

npm run dev

The backend should run on:

http://localhost:5000

Health check:

GET http://localhost:5000/api/health
Frontend Setup

Navigate to the frontend folder:

cd labflow-frontend

Install dependencies:

npm install

Create a .env file:

VITE_API_URL=http://localhost:5000/api

Start the frontend:

npm run dev

The frontend should run on:

http://localhost:5173
Demo Seed Data

LabFlow includes a demo seed script that creates realistic test data.

The seed script creates:

Demo users
Demo projects
Demo tasks
Demo experiments
Demo protocols
Demo equipment
Demo equipment bookings

Run the seed script from the backend folder:

cd labflow-backend
npm run seed

Warning: the seed script clears existing local data and replaces it with demo data.

Demo Accounts
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

These credentials are for local development and demo use only.

Manual Regression Test Coverage

LabFlow MVP Version 1 was manually tested across the following workflows:

Authentication
Register new researcher
Login existing user
Persist login after refresh
Logout
Prevent logged-in users from accessing login/register pages
Projects
Create project
Edit project
Delete project
View projects as researcher
Restrict project management actions by role
Tasks
Create task
Assign task to user
Link task to project
Edit task
Filter tasks
Restrict task deletion by role
Experiments
Create experiment
Link experiment to project
Link experiment to researcher
Link experiment to task
Link experiment to protocol
Edit experiment
Filter experiments
Restrict experiment deletion by role
Protocols
Create protocol
Edit protocol
Approve protocol
Track approved by and approved date
View protocols as researcher
Restrict protocol management by role
Equipment
Create equipment
Edit equipment
View equipment as researcher
Restrict equipment inventory management by role
Equipment Bookings
Create booking
Edit booking
Prevent overlapping confirmed bookings
Allow non-overlapping bookings
Allow cancelled bookings not to block new confirmed bookings
Restrict booking deletion by role
Dashboard
Equipment total updates
Equipment in use now updates
Equipment offline updates
Open tasks update
Overdue tasks update
Upcoming bookings update
Pending protocols update
Experiments needing review update
Important Business Logic
Equipment Booking Conflict Prevention

LabFlow prevents two confirmed bookings from overlapping for the same piece of equipment.

The overlap rule is:

existing.startTime < newEndTime
AND
existing.endTime > newStartTime

This means:

09:00 to 11:00 conflicts with 10:00 to 12:00
09:00 to 11:00 does not conflict with 11:00 to 12:00
Cancelled bookings do not block new confirmed bookings

This logic is handled in the backend, not only in the frontend.

Current Limitations

LabFlow MVP Version 1 is intentionally focused on core workflows.

Current limitations include:

No project membership table yet
No lab or organization model yet
Dashboard is not fully role-specific yet
No file uploads
No email notifications
No audit log
No soft delete or archive-only enforcement for all records
No drag-and-drop calendar
No production deployment setup yet
No automated test suite yet
Future Improvements

Recommended Version 2 improvements:

Project membership system
Lab organization model
Role-specific dashboards
Admin user management page
Soft delete and archive workflows
Audit log for research history
File uploads for experiment data and protocols
Equipment maintenance logs
Calendar view for equipment bookings
Notifications for overdue tasks and upcoming bookings
PDF or CSV export
Automated backend tests
Deployment with hosted PostgreSQL database
Portfolio Notes

LabFlow demonstrates practical full-stack application development with a real-world domain use case.

Key portfolio talking points:

Designed a relational PostgreSQL schema for a research lab workflow
Built an Express API with protected routes and role-based access control
Implemented JWT authentication and password hashing
Created reusable frontend API modules with Axios
Built data-heavy UI pages using Ant Design
Implemented equipment booking conflict prevention
Added a backend dashboard summary endpoint
Created seed data for realistic demo workflows
Manually regression-tested the MVP
License

This project is currently intended for personal portfolio and educational use.
