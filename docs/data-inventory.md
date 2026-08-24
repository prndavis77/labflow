# LabFlow Data Inventory and Classification

**Version:** 1.0  
**Applies to:** Initial United States paid pilot program

## Purpose

This document inventories the principal categories of data stored or processed by LabFlow and assigns an internal data classification.

It supports:

- access-control decisions
- retention planning
- customer offboarding and deletion
- customer data export
- incident response
- backup and recovery planning
- privacy and security documentation

This inventory should be reviewed whenever LabFlow begins storing a materially new category of customer, authentication, research, or operational data.

## Classification Model

LabFlow uses four internal classifications.

### Public

Information intended to be publicly available or whose disclosure would create little or no meaningful risk.

Examples:

- public product documentation
- public application URLs
- intentionally public marketing material

Customer-entered LabFlow data should not normally be classified as Public unless the customer has intentionally made it public.

### Internal

Operational information with limited sensitivity whose unauthorized disclosure would generally create low risk.

Examples may include:

- ordinary equipment names
- generic workflow status
- non-sensitive configuration metadata
- aggregate operational metrics

### Confidential

Customer, research, institutional, or personal information that should be accessible only to authorized users.

Most normal LabFlow customer content falls into this category.

Examples include:

- names and university email addresses
- projects
- experiments
- protocols
- task assignments
- notebook entries
- unpublished research information
- attachments
- audit records

### Security-Sensitive

Information whose disclosure or misuse could enable unauthorized access, compromise accounts or infrastructure, or materially weaken LabFlow security.

Examples include:

- password hashes
- authentication token hashes
- JWT secrets
- database credentials
- Cloudflare R2 credentials
- email-provider credentials
- active bearer tokens
- signed URLs while valid

Security-Sensitive information requires the strongest handling controls.

## Data Inventory

| Data category                     | Typical contents                                                                                 | Primary storage/location                                              | Classification                                                           | Typical access                                                                                      |
| --------------------------------- | ------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| Organization data                 | organization name, workspace identity, organization settings                                     | PostgreSQL                                                            | Confidential                                                             | organization members according to role                                                              |
| User profile data                 | name, email address, role, organization membership, verification status, workflow permissions    | PostgreSQL                                                            | Confidential                                                             | authenticated organization users according to role                                                  |
| Password authentication data      | password hash, tokenVersion, account-security state                                              | PostgreSQL                                                            | Security-Sensitive                                                       | backend authentication logic only                                                                   |
| Password-reset data               | SHA-256 token hash, expiration and state                                                         | PostgreSQL                                                            | Security-Sensitive                                                       | backend authentication logic only                                                                   |
| Email-verification data           | SHA-256 token hash, expiration and state                                                         | PostgreSQL                                                            | Security-Sensitive                                                       | backend authentication logic only                                                                   |
| JWT access tokens                 | user/session claims including tokenVersion                                                       | user browser and request traffic                                      | Security-Sensitive while valid                                           | user and backend                                                                                    |
| Invitation data                   | invited email, role, organization, status, expiration, token hash, delivery state                | PostgreSQL                                                            | Confidential, with token hash Security-Sensitive                         | organization admins and backend                                                                     |
| Raw invitation tokens/links       | temporary invitation credential                                                                  | email and recipient browser; not persisted as raw token in PostgreSQL | Security-Sensitive while valid                                           | intended recipient and backend verification flow                                                    |
| Project data                      | project names, descriptions, status, dates, supervisor, memberships                              | PostgreSQL                                                            | Confidential                                                             | authorized project members and permitted organization roles                                         |
| Project membership data           | users assigned to projects and project-level roles/access relationships                          | PostgreSQL                                                            | Confidential                                                             | authorized organization/project users                                                               |
| Task data                         | titles, descriptions, assignees, due dates, status, completion-review state                      | PostgreSQL                                                            | Confidential                                                             | users authorized for the relevant task/project                                                      |
| Experiment data                   | titles, objectives, workflow state, dates, researcher assignments, review information            | PostgreSQL                                                            | Confidential                                                             | authorized project users                                                                            |
| Protocol/SOP data                 | protocols, methods, equipment procedures, project/equipment links, review state                  | PostgreSQL                                                            | Confidential                                                             | authorized users according to protocol scope                                                        |
| Equipment data                    | names, type, location, status, maintenance information                                           | PostgreSQL                                                            | Internal to Confidential                                                 | organization users according to role                                                                |
| Equipment booking data            | equipment, user, time period, purpose, booking status                                            | PostgreSQL                                                            | Confidential                                                             | authorized organization users                                                                       |
| Notebook entries                  | procedures, observations, results, issues, conclusions, supervisor comments, notes               | PostgreSQL                                                            | Confidential                                                             | authorized project users                                                                            |
| Review history                    | approvals, change requests, reviewer, review comments, timestamps                                | PostgreSQL                                                            | Confidential                                                             | authorized users according to reviewed resource                                                     |
| Audit-log records                 | actor, action, affected resource, timestamps and other recorded audit context                    | PostgreSQL                                                            | Confidential                                                             | authorized administrative/backend access                                                            |
| Attachment metadata               | filename, MIME type, size, parent resource, uploader, upload/archive status and storage metadata | PostgreSQL                                                            | Confidential                                                             | authorized users according to API exposure; backend-only storage metadata not exposed unnecessarily |
| Attachment file contents          | research documents, spreadsheets, images, presentations and other supported research files       | private Cloudflare R2                                                 | Confidential                                                             | authorized users through short-lived signed access                                                  |
| Archived application records      | archived projects, tasks, experiments, protocols and attachments                                 | PostgreSQL and R2 where applicable                                    | Same classification as active record                                     | admins and authorized recovery workflows                                                            |
| Transactional email content       | invitation, verification and password-reset email addresses and message content                  | Mailgun and delivery path                                             | Confidential; embedded active token links Security-Sensitive while valid | intended recipient, LabFlow backend and provider as required                                        |
| Email delivery metadata           | provider, status, message ID, attempt/sent timestamps                                            | PostgreSQL and/or email provider                                      | Internal to Confidential                                                 | backend/admin workflows where exposed                                                               |
| Application logs                  | request identifiers, operational events, sanitized errors, cleanup events                        | Render logging environment                                            | Internal to Confidential                                                 | LabFlow operator                                                                                    |
| Monitoring data                   | uptime checks, service health/readiness status, alert history                                    | Better Stack                                                          | Internal                                                                 | LabFlow operator                                                                                    |
| Database backups                  | copy of relational application data                                                              | backup locations                                                      | Security-Sensitive                                                       | LabFlow operator/recovery process                                                                   |
| Attachment backups                | copies of customer attachment objects                                                            | backup locations                                                      | Confidential                                                             | LabFlow operator/recovery process                                                                   |
| Production configuration metadata | service names, non-secret environment configuration, deployment settings                         | Render/Vercel/provider configuration                                  | Internal                                                                 | LabFlow operator                                                                                    |
| Production secrets                | DATABASE_URL, JWT_SECRET, Mailgun API key, R2 access keys/secrets and comparable credentials     | hosting/provider secret configuration                                 | Security-Sensitive                                                       | LabFlow operator and required backend runtime                                                       |

## Primary Data Processors and Storage Providers

The current production deployment uses:

- Neon PostgreSQL for relational application data
- Cloudflare R2 for private attachment objects
- Render for backend execution and application logs
- Vercel for frontend hosting and delivery
- Mailgun for transactional email delivery
- Better Stack for uptime monitoring and alerting

Not every provider stores customer research content. The specific data categories processed by each provider are identified throughout this inventory and should be carried forward into the LabFlow subprocessor inventory.

## System-Specific Notes

### PostgreSQL

PostgreSQL is LabFlow's primary relational data store.

It contains application state including:

- organizations
- users
- authentication and account-security state
- invitations
- projects
- project memberships
- tasks
- experiments
- protocols
- equipment
- equipment bookings
- notebook entries
- review history
- audit records
- attachment metadata
- archive/recovery state

Most PostgreSQL customer content is classified as Confidential.

Authentication secrets or security-control fields stored there are Security-Sensitive.

### Cloudflare R2

Cloudflare R2 stores the binary content of LabFlow attachments.

The bucket is private.

Attachment objects inherit the classification of their contents and should normally be treated as Confidential.

LabFlow does not assume that an attachment is harmless based solely on its file type.

Access to attachments is controlled by the associated LabFlow resource permissions and short-lived signed URLs.

### Browser-Side Data

The LabFlow frontend stores an authentication token to support persistent login.

A valid bearer token is Security-Sensitive because possession can allow access as the authenticated user until the token expires or is invalidated.

The frontend must not store production infrastructure secrets.

### Transactional Email

Invitation, verification, and password-reset emails contain user email addresses and time-limited links.

The recipient address and ordinary message contents are Confidential.

The active token contained in a link is Security-Sensitive until it expires or is consumed.

Raw reset, verification, and invitation tokens should not be persisted in application logs or normal database fields.

### Application Logs

Production logs may contain:

- request IDs
- application events
- resource identifiers
- operational metadata
- sanitized error information

They must not intentionally contain:

- passwords
- raw authentication tokens
- JWT bearer values
- DATABASE_URL values
- provider API keys
- R2 credentials
- raw reset/verification/invitation tokens
- signed attachment URLs
- unrestricted attachment contents

Log entries should be treated as Internal by default and Confidential where they contain customer-specific identifiers or operational context.

### Backups

Backups inherit the classification of the data they contain.

A complete database backup must therefore be treated as Security-Sensitive because it contains authentication and account-security data in addition to Confidential customer data.

Attachment backups must be treated as Confidential because they may contain customer research information.

Backup access should be limited to the LabFlow operator and recovery processes.

## Customer Data Versus LabFlow Operational Data

### Customer Data

Customer Data includes information entered, created, uploaded, or generated through customer use of LabFlow, including:

- organization information
- user profile information associated with the customer's workspace
- projects
- memberships
- tasks
- experiments
- protocols
- equipment
- bookings
- notebook entries
- review comments/history
- attachments

This category is important for future export, retention, deletion, and offboarding procedures.

### LabFlow Operational Data

Operational Data includes information generated primarily to operate and secure the service, including:

- authentication hashes and security state
- request logs
- application error logs
- monitoring records
- delivery metadata
- infrastructure configuration
- backup metadata
- audit events where required for security or operational purposes

Some operational data may still relate to a customer or user and therefore must be handled appropriately.

## Prohibited Data

The existence of a classification in this inventory does not authorize users to store every type of data that could technically fit that classification.

Data prohibited by the LabFlow Pilot Data Policy remains prohibited.

In particular, the initial pilot does not authorize storage or processing of prohibited categories such as:

- PHI or ePHI
- FERPA-protected education records
- ITAR/EAR-controlled technical data
- classified information
- CUI
- regulated GxP system-of-record data
- credentials or secrets entered by customers
- highly sensitive personal data
- other restricted data identified in the Pilot Data Policy

## Classification Inheritance

Where several data types are combined, the more sensitive classification applies.

Examples:

- an ordinary equipment record is Internal or Confidential
- an equipment attachment containing unpublished research is Confidential
- an email containing an active password-reset link includes Security-Sensitive data
- a PostgreSQL backup containing password hashes must be protected as Security-Sensitive even though most records inside it are Confidential

## Access Principle

Classification does not replace LabFlow's authorization model.

Access remains governed by:

- organization isolation
- user role
- project membership
- resource ownership or workflow permissions
- specific administrative privileges
- backend-only handling for security-sensitive fields

No user should receive access merely because information is classified as Internal or Confidential.

## Review and Maintenance

This inventory should be reviewed:

- before onboarding a paid pilot customer
- when a new data-bearing feature is introduced
- when a new external service begins processing LabFlow data
- when retention or deletion behavior changes
- when export functionality is introduced
- when a security incident reveals a previously unidentified data flow
