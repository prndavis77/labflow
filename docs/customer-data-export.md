# Labfluss Customer Data Export Procedure

**Version:** 1.0
**Applies to:** Initial United States paid pilot program

## Purpose

This document defines the controlled operator procedure for exporting one Labfluss customer organization's data into a portable ZIP package.

The customer export mechanism is intended to support:

- customer-requested data portability
- pilot termination and offboarding
- export before organization deletion
- authorized administrative delivery of customer data

This procedure is separate from organization deletion.

Running a customer export does not delete, archive, freeze, deactivate, or otherwise modify the organization or its customer data.

## Scope

A customer export contains organization-owned customer data that has been explicitly approved for export.

The export includes:

- organization information
- users
- projects
- project memberships
- tasks
- experiments
- protocols and SOPs
- equipment
- equipment bookings
- notebook entries
- review events
- invitations with sensitive invitation internals removed
- customer-facing audit information
- attachment metadata
- available attachment binaries

Archived customer records are included where they are part of the exported datasets.

## Export Format

The operator export produces a ZIP package with a structure similar to:

```text
labflow-export-<organization-slug>-<timestamp>.zip
│
├── manifest.json
├── organization.json
├── users.json
├── projects.json
├── project-members.json
├── tasks.json
├── experiments.json
├── protocols.json
├── equipment.json
├── equipment-bookings.json
├── notebook-entries.json
├── review-events.json
├── invitations.json
├── audit-logs.json
│
└── attachments/
    ├── metadata.json
    ├── manifest.json
    └── files/
        └── <attachment-id>/
            └── <safe-original-filename>
```

The ZIP itself is also assigned a SHA-256 digest by the export process.

## Export Security Model

Customer export is fail-closed for tenant-boundary violations.

Every PostgreSQL dataset is queried explicitly for one organizationId.

The export does not use:

- raw PostgreSQL dumps
- SELECT \* as an export mechanism
- automatic serialization of complete Sequelize models
- unrestricted R2 prefix enumeration as the source of customer-exportable attachments

Exportable model fields are controlled through explicit field allowlists.

This means adding a new database field does not automatically expose that field in future customer exports.

## Data Explicitly Excluded

### Authentication and credential material

The export does not include:

- password hashes
- JWT session version state
- password-reset tokens or token hashes
- email-verification tokens or token hashes
- invitation token hashes
- raw credentials
- application secrets

The PasswordResetToken and EmailVerificationToken models are excluded entirely.

### Invitation internals

The export excludes:

- invitation token hashes
- email-provider implementation details
- provider message IDs

### Attachment storage internals

Customer attachment metadata does not expose:

- Cloudflare R2 storage keys
- storage provider internals
- R2 ETags
- temporary upload-expiration state
- internal sanitized storage filenames where not needed by the customer export

### Audit internals

The initial export format excludes:

- raw audit metadata JSON
- request IP addresses
- user-agent strings

These values are operational/security telemetry rather than ordinary customer workflow content.

## Attachment Export Behavior

Attachment binaries are exported only for attachment records supplied by the organization-scoped PostgreSQL export.

The export process does not assume that every object present under an organization's R2 prefix belongs in the customer export.

This prevents staging objects, rejected uploads, orphaned objects, and unrelated internal storage artifacts from becoming customer-exportable merely because they exist in R2.

For each exported attachment, Labfluss verifies where available:

- organization ownership
- organization R2 namespace
- R2 object presence
- expected file size
- actual exported size
- SHA-256 checksum

### Attachment omissions

A recoverable attachment failure does not automatically prevent the remainder of the customer export from being generated.

Examples include:

- attachment is not in available state
- attachment metadata no longer exists
- R2 object is unavailable
- stored and actual sizes differ
- object read is incomplete
- stored checksum does not match the exported binary

Such cases are reported explicitly in:

`attachments/manifest.json`

The top-level package status becomes:

```text
completed_with_attachment_omissions
```

The operator must review the attachment manifest before delivering such an export to the customer.

### Fail-closed attachment conditions

The export must abort rather than continue when an apparent tenant-boundary or integrity violation is detected, including:

- attachment metadata identifies another organization
- the internal R2 storage key points outside the requested organization's namespace
- duplicate attachment identifiers are supplied to the attachment export operation

A failed tenant-boundary check must never be bypassed merely to complete an export.

## Package Integrity

The top-level:

`manifest.json`

contains:

- export format version
- export timestamp
- organization identity
- record counts
- attachment counts
- attachment byte totals
- overall completion status
- payload file inventory
- byte size for each payload file
- SHA-256 hash for each payload file

`manifest.json` does not hash itself because that would create a recursive self-hash dependency.

The export operation also calculates a SHA-256 hash for the final ZIP.

## Authorization

Customer export is an operator-controlled function for the initial paid pilot.

Before generating an export, verify:

- the organization name
- the organization identifier
- the requesting customer or authorized representative
- the requester's authority
- the reason for export
- where the export will be stored temporarily
- how the export will be delivered
- whether the export is associated with organization offboarding or deletion

If the organization identifier or requester authority is uncertain, do not generate the export.

## Production Prerequisites

Before relying on the production export command, confirm:

- the tested customer-export implementation is deployed
- the production database is the intended Amazon RDS `labflow` production database
- the export command is being run from the authorized production backend environment
- Cloudflare R2 configuration points to the intended production attachment bucket
- production database migrations are current
- the operator has access to an approved temporary export directory
- the destination has appropriate access controls
- sufficient local disk capacity is available
- application logs and monitoring are operational

Do not use the non-production export drill as a production export command.

## Operator Command

From:

```text
labflow-backend
```

run:

```powershell
npm run export:organization -- --organization-id <ID> --confirm-organization-id <ID> --output-dir "<APPROVED_DIRECTORY>"
```

Example:

`npm run export:organization -- --organization-id 17 --confirm-organization-id 17 --output-dir "F:\Labfluss Exports"`

The organization identifier is deliberately supplied twice.

Both values must match before the export proceeds.

This confirmation protects against accidental export of the wrong organization.

The operator script also refuses to overwrite an existing export ZIP of the same name.

## Operator Execution Checklist

1. Verify the request

Record:

- organization name
- organization identifier
- authorized requester
- requester authority
- date of request
- reason for export
- whether the request is related to offboarding
- whether deletion is scheduled afterward
- intended delivery recipient
- approved temporary export location

Stop if requester authority or organization identity cannot be established.

2. Independently verify the organization

Do not rely only on an organization ID copied from an email or support message.

Confirm that the requested organization ID maps to the intended customer before running the export command.

Record the verified:

- organization ID
- organization name
- organization slug where useful

3. Prepare the export location

Use a temporary directory that:

- is not publicly accessible
- is not inside the source-code repository
- is not automatically synchronized to an unauthorized cloud service
- has appropriate operating-system access controls
- has sufficient free disk space

Do not write customer exports into:

- the Git repository
- a public web directory
- source-controlled folders
- shared locations accessible to unrelated customers
- ordinary temporary locations that are not appropriate for customer data

4. Run the export

Run:

```powershell
npm run export:organization -- --organization-id <ID> --confirm-organization-id <ID> --output-dir "<APPROVED_DIRECTORY>"
```

Review the console result.

A successful export reports:

- completion status
- output file path
- ZIP byte size
- ZIP SHA-256
- database record count
- number of attachments exported

Do not copy database credentials, R2 credentials, attachment storage keys, customer content, or production secrets into operational notes.

5. Check the package status

The preferred result is:

```text
complete
```

If the result is:

```text
completed_with_attachment_omissions
```

do not deliver the ZIP without first reviewing:

`attachments/manifest.json`

Determine:

- which attachment was omitted
- why it was omitted
- whether the omission is expected
- whether corrective action is possible
- whether the customer should be informed

Do not claim that the export is complete if the manifest reports omissions.

6. Record package integrity information

Record at minimum:

- organization ID
- export date/time
- generated ZIP filename
- ZIP byte size
- ZIP SHA-256
- export status
- attachment exported count
- attachment omission count
- operator reference

Do not store customer data itself in the operational export record.

7. Verify before delivery

Before transmitting the package, confirm:

- the ZIP exists
- the ZIP filename corresponds to the intended organization
- the export status has been reviewed
- no unexpected attachment omissions remain unresolved
- the recorded SHA-256 matches the operator command output
- the intended recipient has been independently confirmed

For high-risk or unusual cases, independently recompute the SHA-256 before delivery.

8. Deliver using an approved method

The initial paid pilot must not assume ordinary unencrypted email attachments are appropriate for customer research exports.

Use an approved delivery mechanism appropriate to the customer and the sensitivity of the permitted pilot data.

The delivery method should:

- restrict access to the intended recipient
- avoid public links
- avoid uncontrolled forwarding where practical
- use encryption in transit
- provide an expiration or revocation mechanism where available

Record:

- delivery date
- recipient
- delivery method
- export filename or operation reference

Do not record passwords, access tokens, or secret delivery credentials in the general operational record.

9. Obtain or record delivery confirmation where appropriate

Where practical, confirm that the customer or authorized representative successfully received the export.

If organization deletion will follow, the operator should establish whether:

- export delivery has completed
- the customer has confirmed receipt where required
- the customer has declined further export verification
- deletion may proceed according to the offboarding procedure

10. Remove temporary operator copies

After successful authorized delivery and any required verification period:

- remove the temporary operator copy from the export workstation
- remove unintended duplicate copies
- remove copies from temporary staging directories
- confirm that the approved delivery copy, if any, remains only where required

Normal file deletion must not be described as guaranteed forensic secure erasure of SSD or filesystem blocks.

Labfluss can document application-level removal of temporary export artifacts, not guaranteed physical-media overwrite.

11. Record completion

The operational record should contain:

- organization identifier
- export request date
- export execution date
- export status
- ZIP SHA-256
- attachment omission status
- delivery date
- recipient reference
- operator reference
- temporary-copy cleanup status
- whether organization deletion will follow

The record must not contain copies of exported research content, passwords, raw authentication tokens, storage credentials, or other production secrets.

## Stop Conditions

Do not generate or deliver an export if:

- requester authorization is uncertain
- the target organization is uncertain
- production environment identity is uncertain
- the configured R2 bucket is unexpected
- the database is not the intended environment
- a tenant-boundary validation fails
- package creation fails
- the ZIP cannot be stored securely
- delivery recipient identity is uncertain
- a legal, contractual, security, or incident-response hold changes the required procedure

Do not bypass export safeguards to meet an operational deadline.

## Non-Production Export Drill

The end-to-end export drill is intentionally restricted to:

`NODE_ENV=test`

the local PostgreSQL database:

```text
labflow_test
```

and the dedicated Cloudflare R2 bucket:

```text
labflow-test-attachments
```

Run:

```powershell
npm run drill:organization-export
```

The drill:

- verifies the non-production safety boundary
- creates a target organization
- creates an independent neighboring organization
- writes a target attachment to isolated R2
- writes a neighboring attachment to the same isolated R2 bucket
- generates a real customer export ZIP
- writes the ZIP to disk
- reopens it independently
- verifies the ZIP SHA-256
- parses the manifest
- verifies every payload-file size and SHA-256
- verifies the exported attachment bytes
- verifies neighboring PostgreSQL data is absent
- verifies neighboring R2 attachment content is absent
- verifies prohibited sensitive fields are absent
- removes the temporary ZIP and synthetic test fixtures

The drill must never use the production attachment bucket.

The drill must never be repurposed as a production customer export command.

## Verified Non-Production Drill

The customer-export mechanism has been tested end to end against:

- local labflow_test PostgreSQL
- dedicated labflow-test-attachments Cloudflare R2
- two synthetic organizations in the same test environment

The drill verified:

- package generation
- disk writing
- independent ZIP reopening
- ZIP SHA-256 validation
- manifest parsing
- per-file hash validation
- real attachment binary retrieval
- neighboring-organization PostgreSQL isolation
- neighboring-organization R2 isolation
- sensitive-field exclusion
- temporary artifact cleanup

This verification establishes that the tested implementation can produce an isolated portable customer-data package without exposing the neighboring organization's data.

It does not replace the production operator checks defined in this procedure.

## Relationship to Organization Deletion

Customer export should normally occur before permanent organization deletion.

The organization deletion procedure is documented in:

`organization-offboarding.md`

Deletion must not proceed while a required customer export is still pending unless:

the customer explicitly declines export
the customer explicitly requests immediate deletion
another documented legal, contractual, security, or incident-response requirement changes the normal sequence

Customer export itself does not freeze or delete the organization.

## Operational Security Notes

Customer exports may contain unpublished research content and personal account information permitted under the pilot-data policy.

Treat every generated export ZIP as customer confidential data.

Operators must:

- minimize the number of copies
- restrict local access
- avoid source control
- avoid public storage
- avoid copying exports into logs or tickets
- verify recipients before delivery
- remove temporary copies after their operational purpose ends
- avoid retaining exports indefinitely merely for convenience

The customer export package must never contain production credentials or raw authentication secrets.

## Implementation Status

For the initial paid-pilot implementation, Labfluss includes:

- explicit per-model export allowlists
- sensitive-field exclusions
- organization-scoped PostgreSQL export
- consistent PostgreSQL export snapshots
- organization-scoped attachment resolution
- Cloudflare R2 attachment retrieval
- attachment size and checksum verification
- attachment omission reporting
- tenant-boundary fail-closed behavior
- portable ZIP package creation
- top-level package manifest
- per-file SHA-256 integrity metadata
- ZIP SHA-256 calculation
- operator-controlled export command
- isolated end-to-end export drill

A customer-facing self-service export button is not required for the initial paid pilot.

The approved mechanism is an operator-controlled export performed according to this procedure.
