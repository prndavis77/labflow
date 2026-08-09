# LabFlow Backup and Recovery

## Purpose

This document defines the backup inventory, recovery requirements, and recovery objectives for the deployed LabFlow application.

The purpose of backup and disaster-recovery planning is to ensure that LabFlow can be reconstructed after accidental deletion, data corruption, infrastructure failure, credential loss, or provider-level disruption.

The current LabFlow deployment is intended for portfolio demonstrations, controlled pilots, invited testers, and non-sensitive test data. The recovery objectives in this document are appropriate for that deployment stage and do not represent an institutional SLA.

## Production Recovery Inventory

LabFlow depends on several independent production systems. A complete recovery plan must account for all of them.

### 1. PostgreSQL database

Provider:

```text
Neon PostgreSQL
```

Contains recoverable application state including:

- organizations
- users
- authentication and account-security state
- invitations
- projects
- tasks
- experiments
- protocols
- equipment
- equipment bookings
- notebook entries
- review workflow state
- audit-log records
- attachment metadata
- archived/restored resource state
- other relational application data stored by LabFlow

The PostgreSQL database is the primary source of application metadata and relational state.

Loss of the production database would prevent normal LabFlow operation even if all other services remained available.

Recovery priority:

Critical

### 2. Cloudflare R2 attachment objects

Provider:

Cloudflare R2

Contains the binary objects associated with LabFlow attachment metadata.

Examples include uploaded:

documents
images
PDFs
other supported laboratory files

The database contains attachment metadata, but the actual file contents are stored separately in R2.

Database recovery alone therefore does not constitute complete attachment recovery.

Recovery priority:

Critical when attachments are in use

### 3. Application source code

Provider:

GitHub

Repository:

prndavis77/labflow

Contains:

backend source code
frontend source code
Sequelize migrations
package manifests and lock files
deployment-related configuration stored in source control
operational documentation
recovery documentation

GitHub is the authoritative version-controlled copy of the application source.

Recovery priority:

Critical

### 4. Render backend configuration

Provider:

Render

Contains deployment-specific configuration including:

backend service definition
build/start configuration
production environment-variable names and values
secret credentials
deployment linkage to GitHub
attachment-cleanup job configuration
runtime configuration

The values of production secrets must not be committed to Git.

A disaster-recovery procedure therefore must preserve enough information to recreate the configuration without storing plaintext secrets in the repository.

Recovery priority:

High

### 5. Vercel frontend configuration

Provider:

Vercel

Contains deployment-specific configuration including:

project linkage to GitHub
production deployment configuration
frontend environment variables
production domain configuration
framework/build settings where not represented in the repository

Recovery priority:

High

### 6. Mailgun configuration

Provider:

Mailgun

Required for:

invitation email delivery
password-reset email delivery
email-verification delivery

Recoverable configuration includes:

sending domain
sender identity
API-region selection
DNS configuration
API credentials or the ability to generate replacement credentials

Historical delivered email messages are not part of the LabFlow application backup requirement.

Recovery priority:

Medium

### 7. Better Stack monitoring configuration

Provider:

Better Stack

Contains:

frontend uptime monitor
backend liveness monitor
backend readiness monitor
responder/contact configuration
alert-delivery configuration

Loss of Better Stack configuration would not destroy LabFlow application data, but it would remove external outage detection.

Recovery priority:

Medium

## Data Relationships

A complete LabFlow recovery requires consistency between PostgreSQL and R2.

For an attachment to function correctly after recovery:

1. its PostgreSQL metadata must exist
2. its referenced R2 object must exist
3. the restored metadata must reference the correct storage object
4. the application must have valid R2 credentials
5. the object must remain accessible under the expected storage key

This means PostgreSQL and R2 cannot be treated as completely independent recovery targets.

A database restored to an earlier point in time may reference a different set of attachment records than the current R2 bucket contains.

Recovery procedures must therefore include attachment reconciliation.

## What Does Not Require Traditional Backup

Some production components can be reconstructed rather than restored byte-for-byte.

### Frontend deployment artifacts

Vercel deployment artifacts can be regenerated from the GitHub source repository and documented project configuration.

### Backend deployment artifacts

Render deployment artifacts can be rebuilt from:

- GitHub source
- documented service configuration
- restored environment variables and secrets

### Node dependencies

node_modules directories are not backup targets.

Dependencies are reconstructed from the package manifests and lock files.

### Generated logs

Render application logs are useful operational evidence but are not currently treated as authoritative LabFlow business data.

Long-term log archival is outside the scope of the current recovery requirement.

### Temporary signed URLs

R2 upload and download URLs are temporary credentials and must never be backed up as application data.

They should be regenerated when required.

## Recovery Objectives

### Recovery Point Objective

Recovery Point Objective, or RPO, defines the maximum acceptable amount of recently created data that could be lost during a recovery.

For the current LabFlow demo/pilot deployment:

Target RPO: 24 hours or less

This means the recovery strategy should normally permit restoration without losing more than one day of application data.

Where provider-native point-in-time recovery permits a more recent recovery point, the most recent safe recovery point should be used.

For destructive production changes such as important database migrations, an additional recovery point should be created immediately before the change where supported.

### Recovery Time Objective

Recovery Time Objective, or RTO, defines the target time required to return the application to a usable state after a recoverable failure.

For the current LabFlow deployment:

Target RTO: 4 hours

This is a recovery target, not an uptime guarantee or contractual SLA.

A major provider-wide outage may exceed this target.

## Recovery Priority

In a broad disaster, services should normally be recovered in this order:

source code and recovery documentation
PostgreSQL database
Cloudflare R2 attachment storage
backend configuration and deployment
frontend configuration and deployment
transactional email
external monitoring

The database and attachment storage should be validated before declaring application recovery complete.

## Failure Scenarios

The recovery strategy must account for at least the following scenarios:

### Accidental database data deletion

Examples:

- records deleted unintentionally
- bulk update modifies incorrect rows
- application defect corrupts relational data

Required capability:

Restore PostgreSQL to a safe point before the destructive operation.

### Bad database migration

Required capability:

Recover schema and data to a known-good pre-migration state.

### Complete production database loss

Required capability:

Restore PostgreSQL into a replacement Neon database/project if necessary.

### Individual attachment loss

Required capability:

Recover or reconstruct the missing R2 object where backup/version history permits.

### Broad R2 data loss or corruption

Required capability:

Recover attachment objects and reconcile them with restored PostgreSQL metadata.

### Backend hosting loss

Required capability:

Recreate the Render service from GitHub and restored configuration.

### Frontend hosting loss

Required capability:

Recreate the Vercel project from GitHub and restored configuration.

### Credential compromise or loss

Required capability:

Generate replacement credentials, update the hosting environment, and redeploy or restart affected services.

Secrets themselves should not be restored from Git history.

### Monitoring configuration loss

Required capability:

Recreate the documented Better Stack monitors and responder configuration.

## Backup Principles

LabFlow backup and recovery will follow these principles:

1.  A backup is not considered reliable until a restore has been tested.
2.  Production restore testing should use an isolated recovery environment whenever possible.
3.  Production data must not be overwritten merely to test restore capability.
4.  Database and object-storage recovery must be considered together for attachments.
5.  Secrets must not be committed to Git as part of backup documentation.
6.  Backup copies containing production data must be protected appropriately.
7.  Recovery procedures must be reproducible from documentation.
8.  Recovery operations should be verified before recovered infrastructure is declared usable.
9.  Destructive recovery actions require extra caution because restoration can itself destroy newer valid data.
10. Synthetic or non-sensitive data should be used for recovery drills whenever possible.

## Current Provider Capabilities

### Neon PostgreSQL

Neon provides point-in-time recovery within the configured restore-history window.

Neon also supports database snapshots. Snapshots can capture a point-in-time database state and can be restored either directly or through a temporary branch for inspection before finalizing a restore.

Current Neon capabilities must be reviewed against the production plan before defining the final retention policy.

### Cloudflare R2

Cloudflare R2 provides highly durable object storage with provider-managed redundancy.

Provider durability protects against underlying storage-device failure, but durability alone must not be treated as protection from logical deletion, application bugs, credential misuse, or intentional deletion.

The R2 recovery strategy therefore needs separate evaluation in Phase 25B.4.

### Render

Render production environment variables and secrets are managed outside the source repository.

A recovery plan must document which configuration keys are required without recording plaintext production values in Git.

### Vercel

Vercel environment variables are also managed separately from source-controlled application code.

Project configuration represented in repository files is recoverable through Git, while dashboard-only configuration must be documented sufficiently to recreate it.

## Current Recovery Status

| Component                  | Backup/recovery state                                                        | Restore tested                      |
| -------------------------- | ---------------------------------------------------------------------------- | ----------------------------------- |
| PostgreSQL                 | Provider recovery capabilities available; LabFlow strategy not yet finalized | No                                  |
| R2 attachments             | Durable provider storage; LabFlow backup/recovery strategy not yet finalized | No                                  |
| GitHub source              | Version controlled                                                           | Yes, normal clone/redeploy workflow |
| Render configuration       | Exists in production; recovery inventory requires documentation              | No                                  |
| Vercel configuration       | Exists in production; recovery inventory requires documentation              | No                                  |
| Mailgun configuration      | Exists in production; recovery procedure requires documentation              | No                                  |
| Better Stack configuration | Exists in production; recreation procedure requires documentation            | No                                  |

The absence of a tested PostgreSQL restore is the primary recovery gap at the start of Phase 25B.
