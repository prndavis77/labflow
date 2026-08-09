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

Current Neon production capabilities have been reviewed against the deployment plan. The verified Free-plan baseline includes a 6-hour restore-history window, one manual snapshot, no scheduled snapshots, and portable logical backups for additional recovery coverage.

### Cloudflare R2

Cloudflare R2 provides highly durable object storage with provider-managed redundancy.

Provider durability protects against underlying storage-device failure, but durability alone must not be treated as protection from logical deletion, application bugs, credential misuse, or intentional deletion.

The R2 recovery strategy was evaluated and validated in Phase 25B.4.

The current strategy uses private production R2 storage together with independent dated attachment backups. Bucket locking is intentionally not enabled because pending and completed attachment objects share the same storage-key namespace, while the expired-pending-upload cleanup process must remain able to delete partial objects.

A representative attachment restore into an isolated R2 recovery bucket has been successfully tested with SHA-256 integrity verification.

### Render

Render production environment variables and secrets are managed outside the source repository.

A recovery plan must document which configuration keys are required without recording plaintext production values in Git.

### Vercel

Vercel environment variables are also managed separately from source-controlled application code.

Project configuration represented in repository files is recoverable through Git, while dashboard-only configuration must be documented sufficiently to recreate it.

## Current Recovery Status

| Component                  | Backup/recovery state                                                                  | Restore tested                      |
| -------------------------- | -------------------------------------------------------------------------------------- | ----------------------------------- |
| PostgreSQL                 | Backup strategy and restore procedures defined; isolated restore drill pending         | No                                  |
| R2 attachments             | Dated backup created; representative restore verified; combined reconciliation pending | Yes, representative object restore  |
| GitHub source              | Version controlled                                                                     | Yes, normal clone/redeploy workflow |
| Render configuration       | Exists in production; recovery inventory requires documentation                        | No                                  |
| Vercel configuration       | Exists in production; recovery inventory requires documentation                        | No                                  |
| Mailgun configuration      | Exists in production; recovery procedure requires documentation                        | No                                  |
| Better Stack configuration | Exists in production; recreation procedure requires documentation                      | No                                  |

The primary remaining recovery-validation gap is the isolated PostgreSQL restore and combined PostgreSQL/R2 reconciliation drill scheduled for Phase 25B.7.

## PostgreSQL Backup Strategy

### Objective

The PostgreSQL backup strategy protects LabFlow relational data against:

- accidental record deletion
- incorrect bulk updates
- application defects that corrupt stored data
- failed or destructive migrations
- production database loss
- Neon project loss
- situations requiring recovery into a replacement PostgreSQL environment

The strategy uses multiple recovery mechanisms because no single backup method protects against every failure scenario.

## Backup Layers

### Layer 1: Neon point-in-time restore

Neon point-in-time restore is the primary recovery mechanism for recent logical database failures.

The current LabFlow production project is on the Neon Free plan.

Verified production restore-history window:

```text
6 hours
```

This provides fine-grained recovery for failures discovered within the previous six hours.

The current restore-history window does not independently satisfy LabFlow's broader target of retaining a recoverable state from within the previous 24 hours.

The 24-hour recovery objective will therefore be satisfied through the combined backup strategy rather than PITR alone.

LabFlow will use:

Neon PITR for very recent failures
manual Neon snapshots for important known-good recovery points
external PostgreSQL logical backups for portable recovery outside the PITR window

If LabFlow moves to a paid Neon plan in the future, extending the restore-history window to at least 24 hours is preferred.

### Layer 2: Neon snapshots

Neon snapshots provide named database recovery points.

Verified current production capability:

```text
Manual snapshots: Available
Manual snapshot limit on current Free plan: 1
Scheduled snapshots: Not available on current plan
```

The Neon Console currently provides a manual Create snapshot action and requires an upgrade for snapshot schedules.

For the current LabFlow deployment, manual snapshots should be created:

before meaningful production database migrations
before risky data-changing maintenance
before significant database restructuring
before other production changes where a known-good database recovery point is valuable

Because only one manual snapshot is available on the current plan, the existing snapshot may need to be replaced when creating a newer recovery point.

Before deleting or replacing an existing snapshot, confirm that it is no longer the recovery point required for an unresolved incident or recent production change.

Automated daily Neon snapshots are not part of the current Free-plan backup strategy.

### Manual Snapshot Replacement Procedure

The current Neon Free plan permits one manual snapshot.

When a new recovery snapshot is required and an existing manual snapshot already exists:

1. Confirm there is no active incident or unresolved production change that still depends on the existing snapshot.
2. Record the existing snapshot creation time and purpose if it is operationally relevant.
3. Create or verify an external `pg_dump` backup when additional protection is appropriate.
4. Delete the existing Neon snapshot only after confirming it is safe to replace.
5. Create a new manual snapshot from the `production` branch.
6. Confirm the new snapshot appears in Neon Backup & Restore.
7. Record the new snapshot creation time.
8. Do not use the Restore action during snapshot replacement.

Snapshot replacement is a destructive action with respect to the previous named recovery point. It must not be performed casually.

### Layer 3: Portable PostgreSQL logical export

LabFlow should maintain the ability to create an independent logical PostgreSQL backup using pg_dump.

This backup is intended primarily for:

migration to another Neon project
migration to another PostgreSQL provider
recovery when provider-native restore mechanisms are unavailable
retaining an external copy outside the normal Neon recovery timeline
disaster-recovery testing

Logical exports are not the primary mechanism for routine point-in-time recovery.

## pg_dump Requirements

pg_dump must use an unpooled Neon connection string.

Do not use the PgBouncer/pooled connection string for backup exports.

Preferred backup format:

PostgreSQL custom format

Example:

pg_dump `  --format=custom`
--no-owner `  --no-acl`
--file="labflow-production-YYYYMMDD-HHMM.dump" `
"$env:DATABASE_URL"

The environment variable used for this command must contain an unpooled production connection string.

Do not place the production connection string directly in:

- shell history
- scripts committed to Git
- documentation
- backup filenames
- screenshots
- terminal output shared publicly

After the backup completes, clear the temporary environment variable.

Example:

Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue

## Backup File Verification

A successful pg_dump process exit alone is not sufficient evidence that a backup is usable.

For each manually retained logical backup:

1. confirm the command exits successfully
2. confirm the backup file exists
3. confirm the file size is greater than zero
4. inspect the archive using pg_restore --list
5. retain enough metadata to identify when and why the backup was created
6. eventually verify it through an actual restore drill

Example inspection:

pg_restore --list .\labflow-production-YYYYMMDD-HHMM.dump

The backup must not be considered restore-verified until Phase 25B.7 successfully restores and validates it.

## Backup Storage Security

Logical backup files may contain the complete LabFlow production database.

They must therefore be treated as sensitive production data.

Backup files must not be:

- committed to Git
- uploaded to the public repository
- stored in a publicly accessible bucket
- emailed as normal attachments
- placed in publicly shared cloud folders
- left indefinitely in temporary download directories

Where an external logical backup is retained, it should be stored in an access-controlled location.

Encryption at rest should be used where practical.

The backup storage account should use strong authentication and multi-factor authentication where available.

Current logical backup location:

```text
F:\LabFlow Backups
```

## Backup Naming

Use a consistent filename format:

labflow-production-YYYYMMDD-HHMM.dump

For a pre-migration backup, an optional descriptive suffix may be used:

labflow-production-YYYYMMDD-HHMM-pre-migration.dump

Do not include:

- database passwords
- connection strings
- usernames
- API credentials
- customer or organization names
- other sensitive identifiers

## Retention Strategy

For the current LabFlow demo/pilot deployment:

### Neon point-in-time history

```text
Current production window: 6 hours
Preferred: longer when plan and cost permit
```

The current Free-plan PITR window protects against recent failures discovered within six hours.

The broader 24-hour LabFlow recovery objective is achieved through the combined use of PITR, manual snapshots, and portable logical backups rather than PITR alone.

If LabFlow moves to a paid Neon plan, a restore-history window of at least 24 hours is preferred.

### Neon snapshots

Current plan:

```text
Manual snapshots: 1
Scheduled snapshots: unavailable
```

A manual snapshot should normally be maintained around meaningful production changes.

The snapshot should not be treated as the only database backup because:

only one manual snapshot is available
snapshot replacement removes the older named recovery point
snapshots remain within the Neon provider ecosystem

External logical backups provide the additional portable recovery layer.

### External logical backups

At this stage, logical backups are not required daily.

The current production strategy uses:

- 6-hour Neon PITR
- one manually maintained Neon snapshot
- periodic portable logical backups

Because scheduled Neon snapshots are unavailable on the current plan, periodic logical exports provide an important recovery point outside the short PITR window.

Create an external logical backup:

- before major database restructuring when additional protection is appropriate
- before migrations judged higher risk
- before moving between database providers or Neon projects
- for periodic disaster-recovery validation
- when a portable off-provider recovery copy is required

A future institutional deployment should define a stricter automated external-backup retention policy.

## Pre-Migration Backup Policy

Before a production migration with meaningful schema or data risk:

1. confirm current Neon restore capability
2. create a manual Neon snapshot where supported
3. record the snapshot creation time
4. optionally create a pg_dump for higher-risk migrations
5. confirm the backup/snapshot exists
6. only then run the migration
7. verify migration status afterward
8. perform application smoke testing

Simple low-risk migrations may not require a separate logical export if Neon PITR and snapshots are confirmed available.

## Provider Failure Consideration

Neon-native PITR and Neon snapshots are stored within the same provider ecosystem.

They provide strong protection against many application and user errors but should not be treated as a complete independent off-provider disaster-recovery copy.

A pg_dump stored outside Neon provides an additional recovery path if:

- the original Neon project becomes unavailable
- the project is accidentally deleted
- provider-native restore access is unavailable
- LabFlow must be moved to another PostgreSQL provider

This is the primary reason LabFlow retains a logical-export capability even when Neon-native backup features are enabled.

## Production Backup Verification Checklist

Before considering the PostgreSQL backup strategy operational, verify:

- [x] Production Neon plan identified as Free
- [x] Production Neon restore-history window identified as 6 hours
- [x] Manual snapshot capability verified
- [x] Current Free-plan manual snapshot limit identified as 1
- [x] Scheduled snapshots confirmed unavailable on the current plan
- [x] One manual recovery snapshot created
- [x] Manual snapshot creation procedure verified
- [x] Manual snapshot replacement procedure documented
- [x] An unpooled production connection string is available for `pg_dump`
- [x] PostgreSQL client tools are available locally
- [x] A logical backup can be created without exposing credentials
- [x] The logical backup can be inspected with `pg_restore --list`
- [x] Backup storage location is access-controlled
- [x] No backup files are tracked by Git
- [ ] Restore testing remains scheduled for Phase 25B.7

## Current PostgreSQL Backup Status

```text
Neon plan: Free
PITR window: 6 hours, verified
Manual snapshots: Available, limit 1
Scheduled snapshots: Not available on current plan
Manual recovery snapshot: Created
Snapshot branch: production
Snapshot created: 2026-08-09 12:30:17 UTC
Snapshot size: 33.17 MB
Snapshot expiration: none shown by Neon
External logical backup: Created
Logical backup file: labflow-production-20260809-1506.dump
Logical backup size: 107006 bytes
Logical backup format: PostgreSQL custom format
Logical backup archive inspection: Successful
Actual restore: Not yet tested
```

The PostgreSQL backup strategy is not considered fully verified until an isolated restore drill succeeds.

## PostgreSQL Restore Procedure

### Objective

The PostgreSQL restore procedure defines how LabFlow relational data should be recovered without unnecessarily modifying or overwriting the current production database.

The preferred recovery approach is:

1. identify the failure and required recovery point
2. preserve the current production state before destructive recovery where practical
3. preview or restore into an isolated recovery environment first
4. validate schema and representative data
5. only then decide whether production should be replaced or restored

Production must not be overwritten merely to prove that a backup can be restored.

## Restore Methods

LabFlow currently has three PostgreSQL recovery paths:

1. Neon point-in-time restore
2. Neon snapshot restore
3. portable `pg_dump` / `pg_restore` recovery

The appropriate method depends on the failure scenario and age of the required recovery point.

### Recovery Method Selection

| Scenario                                               | Preferred recovery method                        |
| ------------------------------------------------------ | ------------------------------------------------ |
| Recent accidental DELETE or UPDATE within PITR history | Neon point-in-time restore                       |
| Recent bad migration within PITR history               | Neon point-in-time restore                       |
| Known-good manual snapshot exists                      | Neon snapshot restore                            |
| Recovery point is outside current PITR window          | Portable logical backup                          |
| Original Neon project is unavailable                   | Portable logical backup into replacement project |
| Provider migration is required                         | Portable logical backup                          |
| Restore procedure is being tested                      | Isolated recovery database/project               |

## General Restore Safety Rules

Before any restore:

1. Confirm the incident and the approximate time of the destructive event.
2. Determine whether newer valid production data exists that would be lost by restoring to an older point.
3. Record the current production state and recovery decision.
4. Do not run application tests against the production database.
5. Do not overwrite production solely to test recovery capability.
6. Prefer an isolated recovery branch, database, or project for inspection.
7. Use direct, unpooled database connections for restore tooling.
8. Never paste production database credentials into documentation, screenshots, Git, or shared logs.
9. Keep the production backend pointed at the existing production database until the recovered database has been validated.
10. Treat a restore as a potentially destructive production operation.

## Restore Decision Process

When a database recovery incident occurs:

### Step 1: Determine the failure window

Identify:

- when the destructive operation occurred
- when the problem was discovered
- whether the required point is within Neon's current 6-hour PITR history
- whether the current manual snapshot predates the incident
- whether a suitable external logical backup exists

### Step 2: Determine data-loss consequences

Before restoring to an earlier point, identify what valid data was created after that point.

Examples include:

- new users
- projects
- tasks
- experiments
- protocols
- equipment bookings
- notebook entries
- review actions
- invitations
- attachment metadata

A restore that fixes corrupted data can also remove newer valid data.

If newer valid data must be preserved, a selective recovery or data-reconciliation strategy may be safer than a full database rollback.

### Step 3: Preserve current state

Before a destructive production restore, create an additional logical backup of the current database when practical.

This preserves the post-incident state for:

- forensic comparison
- selective data recovery
- rollback of the recovery operation itself

If the database is unavailable or too badly corrupted to export safely, document that limitation.

## Neon Point-in-Time Restore Procedure

Use Neon point-in-time recovery when:

- the required recovery point is within the retained history window
- the approximate safe timestamp is known
- restoring the full relational database state is appropriate

Current LabFlow production PITR history:

```text
6 hours
```

### Procedure

1. Open the Neon production project.
2. Open Backup & Restore.
3. Select the `production` branch.
4. Choose the intended recovery timestamp.
5. Use Neon's preview capability where available to inspect the selected point before committing a restore.
6. Verify representative tables and records.
7. Confirm the chosen timestamp predates the destructive operation.
8. Assess what newer valid data would be lost.
9. Preserve the current production state with a logical export when practical.
10. Only after validation, perform the restore if production recovery is actually required.
11. Confirm Neon reports the restore operation as completed.
12. Verify database connectivity.
13. Verify Sequelize migration state.
14. Verify representative LabFlow data.
15. Verify `/api/ready`.
16. Perform a production application smoke test.
17. Monitor structured backend logs for database or application errors.

Do not experiment with the production Restore action during routine verification.

## Neon Snapshot Restore Procedure

Use a manual snapshot when:

- the snapshot represents a known-good database state
- the required recovery point is older than the current PITR window
- the snapshot was intentionally retained for a migration or production change

Current baseline snapshot:

```text
Branch: production
Created: 2026-08-09 12:30:17 UTC
Size: 33.17 MB
Expiration: none shown by Neon
```

### Procedure

1. Open Neon Backup & Restore.
2. Locate the intended manual snapshot.
3. Confirm the snapshot creation time.
4. Confirm the snapshot predates the incident.
5. Determine what newer production data would be lost.
6. Preserve the current database with a logical backup when practical.
7. Prefer restoring or inspecting the snapshot through an isolated branch or equivalent recovery workflow where Neon permits it.
8. Validate representative data before using the recovered state as production.
9. If a production restore is required, explicitly confirm the destructive operation.
10. After recovery, verify migrations, application data, readiness, and application functionality.

Do not delete the existing snapshot while it is required for an active recovery operation.

## Portable Logical Backup Restore

LabFlow uses PostgreSQL custom-format logical backups created with pg_dump.

Verified backup example:

labflow-production-20260809-1506.dump

The archive has been successfully inspected with pg_restore --list.

It has not yet been restore-verified.

### Isolated Restore Requirement

A logical backup must first be restored into a database that is not the active LabFlow production database.

Recommended targets include:

- a dedicated recovery database in Neon
- a separate Neon recovery project
- another isolated PostgreSQL instance

For the Phase 25B.7 restore drill, a separate Neon recovery target is preferred because it most closely reproduces the production environment without placing production data at risk.

### Preparing a Recovery Database

Before restoring a logical backup:

1. Create an isolated PostgreSQL database or Neon project.
2. Use the same major PostgreSQL version where practical.
3. Obtain a direct, unpooled connection string for the recovery database.
4. Confirm the target is not the production database.
5. Confirm no deployed LabFlow service is using the recovery target.
6. Confirm the target database can safely be replaced or recreated during testing.

Never reuse the production DATABASE_URL as the restore target.

### Logical Restore Command

For a PostgreSQL custom-format archive, use pg_restore.

Example PowerShell workflow:

```powershell
$env:RECOVERY_DATABASE_URL = 'PASTE_RECOVERY_DATABASE_CONNECTION_STRING_HERE'

$backupFile = 'F:\LabFlow Backups\labflow-production-20260809-1506.dump'


pg_restore `
  --verbose `
  --no-owner `
  --no-acl `
  --dbname="$env:RECOVERY_DATABASE_URL" `
  "$backupFile"
```

The recovery connection string must be direct and unpooled.

Do not paste the recovery connection string into:

- documentation
- Git
- screenshots
- shell scripts committed to the repository
- shared terminal output

After the operation:

```powershell
Remove-Item Env:RECOVERY_DATABASE_URL -ErrorAction SilentlyContinue
[bool]$env:RECOVERY_DATABASE_URL
```

Expected:

```text
False
```

### Empty Target Requirement

A full logical restore should normally target an empty database.

Restoring a full archive into a database that already contains LabFlow tables can produce:

- duplicate-object errors
- conflicting enum types
- existing-table errors
- duplicate rows
- sequence inconsistencies
- misleading partial restores

For a recovery drill, prefer creating a clean database rather than trying to merge a full dump into an existing LabFlow schema.

### Restore Error Handling

A restore must not be declared successful merely because pg_restore starts.

Review the complete restore output for:

- errors
- warnings requiring investigation
- extension failures
- ownership issues
- constraint failures
- duplicate-object errors

If the restore produces unexpected errors, stop validation and investigate before using the recovered database.

Do not suppress restore errors merely to make the operation appear successful.

## Post-Restore Validation

After restoring into an isolated recovery database, validate the following.

### Database connectivity

Confirm that PostgreSQL accepts connections.

### Schema presence

Verify expected LabFlow tables exist.

Examples include:

- Organizations
- Users
- Projects
- Tasks
- Experiments
- Protocols
- Equipment
- EquipmentBookings
- NotebookEntries
- Attachments

Actual table names should be verified against the restored schema.

### Migration state

Run the Sequelize migration-status command against the recovery database.

From labflow-backend:

```powershell
$env:DATABASE_URL = 'RECOVERY_DATABASE_CONNECTION_STRING'

npx sequelize-cli db:migrate:status --config src/config/sequelize-cli.js
```

Do not run migrations immediately just because a migration appears pending.

First determine whether:

- the backup was intentionally taken before that migration
- the restored application version matches the backup
- applying the migration is appropriate for the intended recovery point

Clear the recovery connection string afterward.

### Representative data

Verify representative counts and relationships for:

- organizations
- users
- projects
- tasks
- experiments
- protocols
- equipment
- bookings
- notebook entries
- invitations
- attachment metadata

The goal is not merely to see tables, but to confirm relational data is coherent.

### Organization isolation

Verify records remain associated with the expected organizations.

Recovery must not accidentally collapse, duplicate, or cross-link tenant data.

### Account-security state

Verify that restored account-security data is structurally present, including:

- user verification state
- token-version state
- invitation state
- password-reset and verification-token tables where appropriate

Do not expose or reuse historical raw tokens during validation.

### Attachment metadata

Verify attachment metadata exists and retains storage references.

R2 object consistency is evaluated separately under the attachment-recovery subphase.

## Application-Level Recovery Validation

A database restore is not fully validated until the LabFlow application can operate against the recovered database.

During the dedicated restore drill:

1. Point an isolated backend instance or local backend process at the recovery database.
2. Ensure the production frontend/backend remain unchanged.
3. Start the backend.
4. Confirm database connection succeeds.
5. Check `/api/health`.
6. Check `/api/ready`.
7. Perform a representative login.
8. Load representative organization data.
9. Inspect structured logs for failures.

Do not point the deployed production backend at the recovery database during the restore drill.

## Recovery Verification Criteria

A PostgreSQL restore is considered successful only when:

- the restore completes without unexplained errors
- the expected schema exists
- Sequelize migration state is understood
- representative data exists
- important relationships are intact
- organization isolation remains intact
- account-security state is coherent
- the backend can connect to the recovered database
- `/api/ready` succeeds against the recovery environment
- representative LabFlow workflows can read the recovered data

## Production Cutover After Disaster

If a disaster requires replacing the production database with a recovered database:

1. Stop or restrict production writes where practical.
2. Preserve the current production state if possible.
3. Restore and validate the recovery database.
4. Confirm the recovered database is the intended recovery point.
5. Update the backend database connection securely.
6. Restart or redeploy the backend.
7. Verify `/api/health`.
8. Verify `/api/ready`.
9. Verify login.
10. Verify representative application data.
11. Verify organization isolation.
12. Verify attachment metadata.
13. Monitor structured logs.
14. Confirm Better Stack recovery.
15. Document the incident and the final recovery point.

A production database cutover should not occur until the recovered database has passed isolated validation whenever circumstances permit.

## Rollback of a Failed Recovery

A recovery operation itself can introduce problems.

Before a production cutover, retain enough information to return to the pre-recovery state where practical.

If recovery validation fails:

1. Do not continue application writes against the failed recovery target.
2. Restore the previous production connection if it was changed.
3. Preserve logs and error evidence.
4. Reassess the recovery point or backup source.
5. Create a new isolated recovery attempt.
6. Do not repeatedly overwrite production while troubleshooting.

## Phase 25B.3 Verification Checklist

- [x] PostgreSQL recovery methods identified
- [x] PITR restore procedure documented
- [x] Snapshot restore procedure documented
- [x] Logical-backup restore procedure documented
- [x] Production overwrite protections documented
- [x] Isolated recovery target requirement documented
- [x] Restore validation requirements documented
- [x] Production cutover procedure documented
- [x] Failed-recovery rollback procedure documented
- [ ] Actual isolated PostgreSQL restore performed

The unchecked restore item intentionally remains deferred to Phase 25B.7.

## Current PostgreSQL Restore Status

```text
PITR procedure: Documented
Snapshot restore procedure: Documented
Logical restore procedure: Documented
Production cutover procedure: Documented
Actual isolated restore: Not yet performed
```

The PostgreSQL restore procedure is defined, but recovery capability will not be considered restore-verified until the Phase 25B.7 drill succeeds.

## Attachment Storage Backup and Recovery

### Objective

The Cloudflare R2 recovery strategy protects LabFlow attachment objects against failures that provider durability alone does not address, including:

- accidental logical deletion
- application or cleanup defects
- credential misuse
- destructive bulk object operations
- corruption or replacement of stored objects
- loss of the production R2 bucket
- recovery into isolated replacement object storage

Cloudflare R2 remains the production object store for LabFlow attachments. Attachment metadata remains in PostgreSQL.

A complete attachment recovery therefore requires both:

1. recoverable PostgreSQL attachment metadata
2. recoverable R2 objects under the expected storage keys

### Verified Production R2 Configuration

The production attachment bucket is:

```text
Bucket: labflow-attachments
Location hint: Eastern Europe (EEUR)
Default storage class: Standard
Public Development URL: Disabled
Custom domain: None
R2 Data Catalog: Disabled
Bucket lock rules: None
Event notifications: Not enabled
On Demand Migration: Disabled
Local Uploads: Disabled
```

The production bucket remains private.

The current CORS configuration permits the deployed LabFlow frontend and local Vite development origin to perform the required browser operations.

The production bucket currently has no object-expiration lifecycle rule.

The only observed lifecycle rule is Cloudflare's default incomplete multipart-upload abort rule.

### Verified Object-Key Structure

The production attachment namespace is organization-scoped.

Observed structure:

```text
organizations/
  {organizationId}/
    equipment/
    experiment/
    project/
    protocol/
    task/
```

A representative experiment attachment used this structure:

```text
organizations/1/experiment/1/1c4832f3-1984-434a-8177-c65d0a88c1a7/blood-pressure.xlsx
```

The effective storage-key pattern is therefore approximately:

```text
organizations/{organizationId}/{entityType}/{entityId}/{attachmentUuid}/{filename}
```

Upload status is not encoded in the R2 storage key.

The distinction between:

```text
pending
available
failed
```

exists in PostgreSQL attachment metadata.

### Bucket-Lock Decision

Bucket Lock Rules are not enabled on the current production attachment bucket.

Reason:

The current object-key hierarchy does not separate pending upload objects from completed attachment objects.

LabFlow's expired-pending-upload cleanup process intentionally deletes partial R2 objects before changing the associated PostgreSQL attachment record to `failed`.

A retention lock applied to the current attachment prefixes could therefore block legitimate cleanup deletion and cause normal maintenance failures.

For example, locking:

```text
organizations/
```

or an organization/entity prefix would also apply to pending upload objects stored under that prefix.

LabFlow will not redesign the object-key hierarchy solely to support bucket locking during the current production-hardening phase.

A future design may reconsider prefix-scoped retention if temporary and durable attachment objects are separated into distinct namespaces.

### R2 Recovery Strategy

The current recovery strategy uses two layers:

1. Cloudflare R2 as the private production object store.
2. Independent dated attachment backup copies stored outside the production R2 bucket.

The independent copy is required because R2 durability does not independently protect LabFlow from logical deletion, application defects, credential misuse, or destructive object operations.

For the current demo/pilot deployment, the first independent copy is stored locally in an access-controlled backup location.

Current attachment backup root:

```text
F:\LabFlow Backups\attachments
```

The backup is organized into dated recovery sets rather than a continuously mirrored directory.

Example:

```text
F:\LabFlow Backups\attachments\
  2026-08-09\
    organizations\
      ...
```

A dated copy is preferred over a destructive mirror because deletion from production must not automatically remove the corresponding recovery copy.

### Attachment Backup RPO

LabFlow's overall recovery target remains:

```text
RPO: 24 hours or less
```

The attachment backup strategy should therefore eventually provide a recoverable attachment state from within the previous 24 hours.

Current implementation:

```text
Manual dated attachment backup
```

Future pilot implementation:

```text
Automated daily attachment backup
```

Additional attachment backups should be created before:

- storage-key migrations
- bulk R2 object operations
- physical attachment-deletion implementations
- other risky storage changes

### First Production Attachment Backup

The first dated production R2 attachment backup was created on:

```text
2026-08-09
```

Backup location:

```text
F:\LabFlow Backups\attachments\2026-08-09
```

Production inventory before backup:

```text
Total Objects: 47
Total Size: 22735636 bytes
```

Local backup verification:

```text
Local files: 47
Local size: 22735636 bytes
```

The production and local inventory counts and byte totals matched exactly.

### SHA-256 Integrity Manifest

A SHA-256 manifest was created for the first attachment backup.

Manifest:

```text
F:\LabFlow Backups\attachments\2026-08-09\sha256-manifest.csv
```

Verified manifest entries:

```text
47
```

The manifest records:

- relative object path
- file size
- SHA-256 hash

The manifest is part of the backup material and must not be committed to Git.

Production attachment filenames and storage-key structure may be present in the manifest.

### Recovery-Test Bucket

An isolated R2 bucket was created for recovery validation:

```text
labflow-attachments-recovery-test
```

Verified configuration:

```text
Location hint: Eastern Europe (EEUR)
Public Development URL: Disabled
Custom domain: None
CORS: None
Bucket lock rules: None
Default storage class: Standard
```

The recovery bucket is not used by the production LabFlow application.

It exists only as an isolated recovery target.

### Recovery Credential Isolation

A dedicated R2 Object Read & Write credential was created for the recovery-test bucket.

The credential was restricted to:

```text
labflow-attachments-recovery-test
```

Scope verification produced:

```text
Recovery bucket: Accessible
Production bucket: AccessDenied
```

This confirms that the recovery credential can write restored objects into the isolated recovery bucket without receiving access to the production `labflow-attachments` bucket.

The recovery credential must not be committed to Git or stored in documentation.

Temporary PowerShell environment variables used during the drill were cleared after use.

### Representative Attachment Restore Test

A representative attachment was restored from the local dated backup into the isolated R2 recovery bucket.

Test object:

```text
organizations/1/experiment/1/1c4832f3-1984-434a-8177-c65d0a88c1a7/blood-pressure.xlsx
```

Recovery path:

```text
local dated attachment backup
-> isolated R2 recovery bucket
-> download from recovery bucket
-> SHA-256 comparison
```

The upload into the recovery bucket succeeded.

The recovered object was then downloaded from the recovery bucket successfully.

Original backup SHA-256:

```text
4DF3FFAEAB5108C98337227D75263FF220A920DBD1E3AD74E81B9B2239F415E5
```

Recovered-object SHA-256:

```text
4DF3FFAEAB5108C98337227D75263FF220A920DBD1E3AD74E81B9B2239F415E5
```

The hashes matched exactly.

This confirms that the tested attachment could be restored from the independent backup into isolated R2 storage and recovered byte-for-byte.

### Attachment Recovery Procedure

For recovery of one or more attachment objects:

1. Identify the required attachment metadata in PostgreSQL.
2. Determine the expected R2 storage key.
3. Locate the required object in a dated attachment backup set.
4. Verify the backup copy against the SHA-256 manifest where available.
5. Create or select an isolated recovery bucket.
6. Use recovery-only credentials that do not grant unnecessary production-bucket access.
7. Restore the object using the same storage key expected by PostgreSQL.
8. Download the restored object from the recovery bucket.
9. Compare the recovered file hash with the backup manifest.
10. Only after validation, decide whether the restored object should be copied into replacement or production storage.
11. Verify that LabFlow attachment metadata points to the correct storage key.
12. Verify application-level download behavior after recovery.

Do not delete a production object merely to test recovery.

### PostgreSQL and R2 Reconciliation

A restored PostgreSQL database and a restored attachment backup may represent different points in time.

After any database restore, attachment reconciliation must identify at least:

- active attachment metadata whose R2 object is missing
- archived attachment metadata whose R2 object is missing
- R2 objects for which no restored PostgreSQL attachment metadata exists
- attachment records whose expected storage key differs from recovered storage
- pending attachment rows that should not be treated as completed attachment recovery targets

The database remains authoritative for LabFlow attachment metadata and workflow state.

R2 remains authoritative for the binary object content at the referenced storage key.

An attachment should not be considered fully recovered until both sides are consistent.

### Current Limitations

The current attachment backup strategy has these limitations:

- the first independent backup is stored on local storage
- local storage does not protect against loss of the local machine or backup drive
- daily attachment backup automation is not yet implemented
- no provider-independent remote backup copy has yet been configured
- full PostgreSQL-plus-R2 recovery reconciliation has not yet been performed
- only one representative R2 object has been restore-tested
- the production bucket does not currently use bucket locking
- the current storage-key hierarchy does not separate pending and completed attachment objects

For a real customer pilot, add an off-machine or off-provider backup copy and automate attachment backups sufficiently to meet the intended RPO.

### Phase 25B.4 Verification Checklist

- [x] Production R2 bucket inspected
- [x] Production bucket confirmed private
- [x] Production location and storage class recorded
- [x] Current lifecycle configuration reviewed
- [x] Bucket-lock capability evaluated
- [x] Bucket lock intentionally not enabled because of pending-upload cleanup semantics
- [x] Object-key hierarchy inspected
- [x] Organization and entity-type scoping confirmed
- [x] Pending and completed objects confirmed to share the same storage namespace
- [x] Production R2 inventory recorded
- [x] First dated independent attachment backup created
- [x] Production and local object counts matched
- [x] Production and local byte totals matched
- [x] SHA-256 manifest created
- [x] Isolated R2 recovery bucket created
- [x] Recovery-only credential created
- [x] Recovery credential access to production bucket denied
- [x] Representative attachment restored into isolated R2 storage
- [x] Recovered attachment downloaded successfully
- [x] Recovered SHA-256 matched original backup SHA-256
- [x] PostgreSQL/R2 reconciliation requirement documented
- [ ] Automated daily attachment backup not yet implemented
- [ ] Off-machine/off-provider attachment backup copy not yet implemented
- [ ] Full database-plus-R2 recovery reconciliation remains scheduled for Phase 25B.7

### Current Attachment Recovery Status

```text
Production R2 bucket: Private and verified
Bucket lock: Not enabled by design
Independent dated backup: Created
Backup date: 2026-08-09
Backup object count: 47
Backup object bytes: 22735636
SHA-256 manifest: Created, 47 entries
Isolated recovery bucket: Created
Recovery-only credential isolation: Verified
Representative object restore: Successful
Representative hash verification: Successful
Full PostgreSQL/R2 reconciliation drill: Not yet performed
```

Phase 25B.4 is complete for the current demo/pilot production-hardening stage.

The attachment backup and recovery procedure has been demonstrated using an isolated recovery target without modifying or deleting production attachment objects.

Full combined recovery remains part of Phase 25B.7.
