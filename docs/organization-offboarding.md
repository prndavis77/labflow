# LabFlow Organization Offboarding and Deletion Procedure

**Version:** 1.1
**Applies to:** Initial United States paid pilot program

## Purpose

This document defines how a LabFlow customer organization is offboarded and how its production data is permanently removed after a paid pilot ends or when earlier deletion is requested.

This procedure supports the LabFlow:

- Pilot Data Policy
- Data Inventory and Classification
- Data Retention Policy
- Backup and Recovery procedures

Organization offboarding is different from ordinary record archiving.

Archiving keeps records recoverable within LabFlow. Organization deletion is intended to permanently remove the customer's active production data from LabFlow's production systems, subject to documented backup-retention and preservation exceptions.

## Scope

This procedure applies to customer data associated with a LabFlow organization, including:

- organization records
- user accounts
- invitations
- projects
- project memberships
- tasks
- experiments
- protocols and SOPs
- equipment
- equipment bookings
- notebook entries
- review history
- attachment metadata
- attachment objects
- archived customer records
- authentication and account-security state associated with organization users
- other organization-owned application records

Operational records such as logs, monitoring history, backups, and limited audit information may follow separate retention rules defined in the Data Retention Policy.

## Offboarding Triggers

Organization offboarding may begin when:

- a paid pilot reaches its agreed end date
- the customer asks to terminate the pilot
- LabFlow and the customer mutually agree to end the pilot
- LabFlow terminates the pilot under the applicable agreement
- the customer requests earlier deletion of its production data
- another documented contractual reason requires offboarding

A security incident, legal hold, contractual preservation requirement, or similar obligation may temporarily alter the normal deletion timeline.

## Offboarding States

For the initial paid pilot, organization offboarding should use the following operational states.

### Active

The organization operates normally.

Users can authenticate and use the workspace according to their permissions.

### Offboarding

The pilot has ended or termination has been initiated.

The organization is within the offboarding period.

During this period:

- customer data remains protected
- export may be coordinated
- deletion readiness may be verified
- new long-term use of the workspace should not continue
- access may be restricted where appropriate

### Deletion Scheduled

The customer export opportunity has concluded or the customer has requested earlier deletion.

Deletion has been approved and scheduled.

### Production Data Deleted

Organization customer data has been removed from active production systems.

Residual copies may exist only in protected backups or retained operational records according to the Data Retention Policy.

## Default Timeline

Unless another period is agreed in writing:

1. the offboarding period begins when the pilot terminates
2. the customer has up to 30 days for export and offboarding coordination
3. the customer may request earlier deletion
4. active production data should be permanently removed no later than the end of the 30-day period
5. historical backups expire according to their normal backup-retention schedule

Deletion may be delayed only where a documented legal, contractual, security, or incident-response preservation requirement applies.

## Authorization to Request Organization Deletion

Organization deletion is a destructive action and must not be initiated by an ordinary user.

For the initial pilot, a deletion request should require:

- a request from the customer's designated administrator or other authorized customer representative
- verification that the request concerns the correct organization
- confirmation by the LabFlow operator before execution

If there is uncertainty about the authority of the requester, deletion must not proceed until authorization is verified.

## Deletion Confirmation

Before permanent deletion, LabFlow should confirm:

- organization name
- organization identifier
- requester identity
- reason for deletion
- whether the pilot has ended
- whether an export has been requested or completed
- requested deletion date
- whether any preservation hold applies

The requester should be informed that permanent production deletion is not the same as archive and cannot normally be reversed after backups expire.

## Export Before Deletion

Where customer export is available, the customer should be given the opportunity to receive or request an export before permanent deletion.

The export step should occur before destructive deletion unless:

- the customer explicitly declines export
- the customer explicitly requests immediate deletion
- a security or legal reason requires another response

The detailed export format and export procedure are defined separately under the customer-data-export phase.

## Access During Offboarding

The initial pilot does not require fully automated workspace suspension.

Depending on the circumstances, LabFlow may:

- allow temporary read access for export verification
- restrict creation of new customer data
- disable selected accounts
- disable all workspace authentication after export is complete
- revoke access immediately where security requires it

Any access allowed during offboarding remains subject to normal authentication, authorization, and organization-isolation controls.

## Organization Data Deletion Inventory

Permanent organization deletion must account for all organization-owned customer data.

### PostgreSQL data

The deletion process must account for:

- organization record
- users
- password hashes
- account-security state
- password-reset token hashes
- email-verification token hashes
- invitations
- invitation token hashes
- projects
- project memberships
- tasks
- experiments
- protocols
- equipment
- equipment bookings
- notebook entries
- review events/history
- attachment metadata
- archived records
- organization-owned audit records where deletion is required by policy
- other organization-scoped relational data

The implementation must not assume that deleting only the organization row will safely remove every dependent record unless database constraints and cascade behavior have been explicitly reviewed and tested.

### Cloudflare R2 attachment objects

All attachment objects belonging to the organization must be identified and removed from the production R2 bucket.

The implementation must determine how all attachment objects belonging to the organization can be identified reliably.

Where object keys contain an organization-specific namespace, that namespace may be used as part of deletion and reconciliation. The deletion procedure must not rely on that assumption until the attachment key structure has been verified against the production implementation.

Deletion must include:

- active attachment objects
- archived attachment objects
- any permanent attachment objects still referenced by organization metadata
- orphaned organization attachment objects identified during reconciliation

Temporary or staging objects associated with the organization should also be removed where applicable.

### Transactional email data

Application-side invitation and delivery metadata should be removed according to the deletion and retention rules for the organization.

External Mailgun records may remain temporarily according to provider retention and the LabFlow retention/subprocessor documentation.

### Browser sessions

LabFlow cannot directly erase a token already stored in a user's browser.

Before or during organization deletion:

- organization users should no longer be able to authenticate successfully
- user/account records and authentication state should be removed or disabled
- previously issued JWTs must cease to provide authorized access

Deletion testing must verify that former organization tokens cannot access organization resources after offboarding.

## Audit Records

Audit records require special treatment.

During an active organization, audit history supports:

- administrative accountability
- security investigation
- troubleshooting
- review history

The Data Retention Policy permits relevant audit information to remain for up to 180 days after termination where needed for security, accountability, troubleshooting, or incident investigation.

Therefore organization deletion must distinguish between:

1. customer workflow content that should be deleted with the organization
2. limited operational or security audit records that may be retained temporarily under the retention policy

Retained audit information should avoid preserving unrestricted copies of deleted customer research content.

Where practical, retained records should contain only the minimum identifiers and event information required for the permitted retention purpose.

## Deletion Order

Deletion must be performed in an order that avoids orphaned records, broken foreign-key relationships, or inaccessible R2 objects.

The final implementation order must be derived from the actual Sequelize model relationships and database constraints.

A safe conceptual order is:

1. identify the target organization
2. prevent new customer-data mutations and revoke or restrict organization access
3. inventory organization-owned PostgreSQL records and attachment objects
4. preserve only the operational evidence required by the retention policy
5. begin permanent deletion
6. delete organization-owned R2 attachment objects
7. delete dependent PostgreSQL records
8. delete organization users and authentication state
9. delete the organization record
10. reconcile PostgreSQL and R2
11. verify organization access no longer works
12. record deletion completion outside the deleted tenant data where necessary

During the destructive deletion phase, the organization must not be allowed to create or modify customer data.

LabFlow enforces this requirement through the organization access-freeze mechanism. The organization is marked inactive, a persistent offboarding freeze timestamp is recorded, organization-user session versions are invalidated, relevant outstanding account-recovery tokens are invalidated, authentication rejects inactive organizations, and permanent deletion is blocked until the signed-upload quiescence period has elapsed.

The precise database deletion sequence must be tested against the production schema before the procedure is relied upon.

## Transaction Boundaries

PostgreSQL deletion operations should use a database transaction where practical.

Cloudflare R2 object deletion cannot participate in the same PostgreSQL transaction.

Organization deletion is therefore a multi-system operation and cannot be treated as one atomic database transaction.

The deletion process must tolerate and detect partial failure.

For example:

- PostgreSQL deletion succeeds but some R2 objects remain
- R2 deletion succeeds but PostgreSQL deletion fails
- provider connectivity fails partway through deletion

The procedure must record enough state to allow safe retry and reconciliation.

## Failure Handling

If organization deletion fails:

- do not report the organization as fully deleted
- restrict customer access where appropriate
- preserve the failure details in sanitized operational logs
- determine which deletion stages succeeded
- retry remaining safe deletion operations
- reconcile PostgreSQL metadata and R2 object state
- do not recreate deleted customer data merely to make systems appear consistent

A deletion attempt should be idempotent where practical so retrying the same organization does not cause unsafe behavior.

## Attachment Reconciliation

After organization deletion:

- no active PostgreSQL attachment metadata should remain for the deleted organization
- no identified production R2 attachment object belonging to the deleted organization should remain
- staging/orphan objects should be checked where applicable

If database metadata is deleted but an R2 object remains, that object must be treated as residual customer data and removed.

If the R2 object is deleted but metadata remains because the database step failed, the deletion procedure should continue or retry rather than attempting to restore the attachment unless required for recovery from an erroneous deletion.

## Backup Handling

Organization deletion does not require record-by-record modification of existing historical backups.

Instead:

- production data is removed from PostgreSQL and R2
- future backups must not include the deleted production data
- pre-existing backup copies remain protected
- backup copies expire according to the documented backup-retention schedule

If an old backup is restored for disaster recovery, deletion reconciliation must prevent previously deleted organizations from being unintentionally returned to active production use.

## Individual User Removal

Individual user offboarding during an active organization is different from organization deletion.

When an individual leaves the laboratory:

- the user's authentication access should be disabled or removed
- active credentials should no longer authorize access
- project membership should be reviewed
- future assignments should be transferred where appropriate

Historical records may continue to identify the former user where necessary for:

- experiment authorship
- review history
- task history
- booking history
- audit accountability
- other research provenance

Personal profile information should be minimized where practical without corrupting legitimate historical records.

Full organization deletion ultimately removes that customer-associated identity data subject to applicable operational-retention exceptions.

## Deletion Verification

Organization deletion must not be considered complete until verification has been performed.

Verification should confirm at minimum:

- organization record no longer exists in active production data
- organization users cannot authenticate or access protected APIs
- organization projects are no longer retrievable
- tasks are no longer retrievable
- experiments are no longer retrievable
- protocols are no longer retrievable
- equipment records are no longer retrievable
- equipment bookings are no longer retrievable
- notebook entries are no longer retrievable
- project memberships are removed
- customer attachment metadata is removed
- organization R2 attachment objects are removed
- archived records are removed
- prohibited stale JWT access is rejected
- no obvious orphaned organization records remain

Where technically practical, the verification process should compare organization-scoped record counts before and after deletion.

## Deletion Record

LabFlow should maintain a minimal operational record that an organization deletion occurred.

The deletion record should contain only information necessary to demonstrate and troubleshoot the deletion, such as:

- deletion operation identifier
- organization identifier
- organization name or minimized reference where appropriate
- deletion request date
- deletion execution date
- requester/authorizer reference
- completion status
- export status
- verification status
- operator reference
- failure/retry status where applicable

The deletion record must not contain copies of deleted research content, attachment contents, passwords, raw tokens, or production secrets.

Retention of the deletion record should follow the applicable operational/audit retention period.

The deletion record must be operational data independent of the deleted organization's tenant records. It must not require the deleted organization row to continue existing through a foreign-key relationship.

Where an organization identifier is retained, it should be treated as a historical reference rather than an active tenant relationship.

## Customer Confirmation

After successful deletion, LabFlow may provide the customer with a confirmation stating that:

- active production customer data has been deleted
- normal application access has ended
- residual copies may remain temporarily in protected backups
- those backup copies will expire according to the applicable retention schedule

LabFlow should not claim that every historical backup copy has been immediately erased unless that has actually occurred.

## Implementation Requirement

This procedure must not be represented as technically implemented until the production deletion mechanism has been built and verified.

Before the first paid pilot relies on organization deletion, LabFlow should have:

- an operator-run organization deletion mechanism
- explicit organization-scoped deletion logic
- R2 organization-object deletion
- PostgreSQL transaction/reconciliation behavior
- authentication invalidation
- partial-failure handling
- deletion verification
- automated tests using a dedicated non-production database and object-storage test environment
- a documented manual execution checklist

A customer-facing self-service "Delete Organization" button is not required for the initial paid pilot.

An operator-run procedure is acceptable provided it is controlled, authenticated, tested, and documented.

## Test Requirements

At minimum, organization deletion testing should verify:

- only the target organization is deleted
- another organization remains unchanged
- users are deleted or otherwise removed according to the procedure
- deleted or disabled organization accounts can no longer authenticate
- previously issued authentication tokens for organization users no longer authorize protected API access
- invitations are removed appropriately
- projects and project memberships are removed
- tasks are removed
- experiments are removed
- protocols are removed
- equipment and bookings are removed
- notebook entries are removed
- review history is removed according to the applicable policy
- attachment metadata is removed
- R2 attachment objects are removed
- archived resources are removed
- retries after partial failure are safe
- failure of R2 deletion does not falsely report full deletion
- failure of PostgreSQL deletion does not falsely report full deletion
- no cross-organization deletion occurs
- deletion completion is recorded appropriately

Tests must use non-production data.

## Operator Execution Checklist

This checklist is the controlled operator procedure for production organization deletion during the initial paid pilot.

It must be followed for every permanent organization deletion.

The operator must not substitute ad hoc SQL statements, direct R2 object deletion, or the non-production deletion-drill script for the approved production deletion mechanism.

### 1. Verify authorization and deletion scope

Before changing organization access or deleting any data, record and verify:

- organization name
- organization identifier
- authorized requester
- requester authority
- reason for deletion
- deletion request date
- requested execution date
- pilot termination status
- export status
- whether earlier deletion was explicitly requested
- whether any legal, contractual, security, incident-response, or other preservation hold applies

Deletion must stop if:

- requester authority is uncertain
- the organization identifier is uncertain
- a required export has not been completed or declined
- a preservation hold applies
- another unresolved contractual requirement prevents deletion

The operator must independently confirm that the organization identifier being supplied to the deletion mechanism belongs to the intended customer.

### 2. Verify production deletion prerequisites

Before production deletion is attempted, verify that the currently deployed production environment contains the required organization-offboarding implementation and database schema.

At minimum confirm:

- the organization access-freeze implementation is deployed
- organization authentication checks reject inactive organizations
- `organizations.offboarding_frozen_at` exists in the production database
- the organization deletion and reconciliation services are deployed
- organization-scoped R2 deletion is deployed
- production migrations are current
- the configured R2 bucket is the intended production attachment bucket
- the configured PostgreSQL database is the intended production database
- monitoring and application logging are operational

Do not execute deletion if the deployed code and database schema are not known to match the tested deletion implementation.

### 3. Establish independent pre-deletion evidence

Before permanent deletion, record organization-scoped evidence sufficient to verify what is about to be removed.

The evidence should include, where practical:

- organization identifier
- organization name
- organization active/inactive state
- user count
- project count
- task count
- experiment count
- protocol count
- equipment count
- equipment-booking count
- notebook-entry count
- project-membership count
- review-event count
- invitation count
- password-reset-token count
- email-verification-token count
- attachment metadata count
- organization-scoped audit-record count where applicable
- R2 organization prefix
- number of R2 objects currently under that prefix

The operator must not record:

- passwords
- password hashes
- raw JWTs
- raw invitation tokens
- raw reset tokens
- raw verification tokens
- attachment contents
- research content unless strictly necessary for an authorized operational purpose
- production secrets

Pre-deletion evidence must be stored independently of the organization records that will be deleted.

### 4. Freeze organization access

Invoke the approved organization access-freeze mechanism for the exact organization identifier.

The freeze must establish both:

- `organizations.is_active = false`
- a persistent `organizations.offboarding_frozen_at` timestamp

The freeze mechanism must also invalidate organization-user sessions and outstanding account-recovery tokens according to the deployed implementation.

After the freeze, verify:

- the organization is inactive
- `offboarding_frozen_at` is populated
- an existing organization-user JWT no longer authorizes a protected API request
- a fresh login for an organization user is rejected
- another active organization remains able to authenticate normally

Do not manually reactivate the organization after this point.

### 5. Wait for signed-upload quiescence

Freezing authentication does not invalidate an R2 upload URL that was already signed before the freeze.

Permanent attachment deletion must therefore not begin until every previously issued upload URL could have expired.

For the current pilot configuration:

- attachment upload URL TTL: 300 seconds
- deletion safety margin: 60 seconds
- required quiescence period: 360 seconds

The 360-second period begins at the persisted `offboarding_frozen_at` timestamp.

The deletion mechanism must independently enforce this requirement.

Do not bypass, shorten, or manually override the quiescence period.

If the configured upload URL TTL changes, the required quiescence period must be recalculated from the deployed configuration rather than relying on this documented numeric value alone.

### 6. Re-inventory before destruction

After the quiescence period has elapsed and immediately before deletion:

- confirm that the target organization remains inactive
- confirm that `offboarding_frozen_at` is still present
- confirm that the correct organization identifier is still selected
- inventory organization-owned PostgreSQL data again
- inventory the complete organization R2 namespace again
- confirm that the R2 namespace is exactly the organization-scoped prefix expected by the deployed storage-key implementation
- confirm that a neighboring organization remains present and active

If any unexpected data, organization state, namespace, or configuration is observed, stop and investigate before deletion.

### 7. Execute the approved deletion orchestration

Use the approved production organization-deletion orchestration.

The operator must not separately delete PostgreSQL rows first.

The expected high-level sequence is:

1. verify the organization remains frozen
2. verify upload quiescence has elapsed
3. derive the current PostgreSQL/R2 reconciliation state
4. delete all objects under the exact organization R2 namespace
5. verify that the organization R2 namespace is empty
6. transactionally delete organization-owned PostgreSQL data
7. delete organization users and authentication state
8. delete the organization record
9. derive the reconciliation state again

The R2 deletion must include:

- permanent attachment objects
- staging objects
- orphaned organization objects
- archived organization attachment objects
- any other objects under the exact organization namespace

The database deletion step must not proceed on the assumption that attachment storage has been removed unless R2 deletion has been verified successfully.

### 8. Handle partial failure by reconciliation state

Organization deletion spans PostgreSQL and R2 and is not one atomic transaction.

If the deletion mechanism reports a failure, do not report the organization as deleted.

Determine the resulting reconciliation state.

The supported operational states are:

- `PENDING`
- `STORAGE_DELETED_DATABASE_PENDING`
- `DATABASE_DELETED_STORAGE_REMAINING`
- `COMPLETE`

If R2 deletion fails before storage is verified empty:

- do not delete PostgreSQL attachment metadata or organization data merely to force completion
- preserve the frozen organization state
- investigate the storage failure
- retry the approved reconciliation process when safe

If R2 deletion succeeds but PostgreSQL deletion fails:

- keep the organization frozen
- do not recreate the deleted R2 objects merely to restore symmetry
- confirm that the PostgreSQL transaction rolled back where expected
- record the `STORAGE_DELETED_DATABASE_PENDING` state
- retry the approved reconciliation process

If PostgreSQL is already absent but organization R2 objects remain:

- treat the objects as residual customer data
- run the approved storage-only reconciliation path
- verify the namespace becomes empty

Do not manually manufacture a `COMPLETE` result.

### 9. Verify deletion completion

Deletion is complete only when independent post-deletion verification succeeds.

Verify at minimum:

- organization record is absent
- organization users are absent according to the deletion procedure
- projects are absent
- project memberships are absent
- tasks are absent
- experiments are absent
- protocols are absent
- equipment is absent
- equipment bookings are absent
- notebook entries are absent
- review events are absent according to policy
- invitations are absent
- password-reset-token records are absent
- email-verification-token records are absent
- attachment metadata is absent
- organization-owned audit records scheduled for deletion are absent
- archived organization records are absent
- the exact organization R2 namespace contains zero objects
- an old organization JWT cannot authorize protected API access
- a fresh login for a former organization user cannot succeed
- no obvious organization-owned orphan records remain
- the reconciliation state is `COMPLETE`

Where practical, compare the pre-deletion record inventory with the post-deletion record inventory.

### 10. Verify neighboring organization isolation

As an additional safety check, verify that at least one known active neighboring organization remains unaffected.

Confirm, where practical:

- neighboring organization record still exists
- neighboring organization remains active
- neighboring users remain present
- neighboring authentication still works
- neighboring R2 namespace remains unchanged

Any unexpected cross-organization change must be treated as a security incident and investigated immediately.

### 11. Verify idempotent reconciliation

After successful deletion, run the approved reconciliation mechanism again for the deleted organization.

The second execution must:

- remain safe
- not recreate deleted data
- not affect another organization
- report or derive a completed reconciliation state

An idempotent retry provides evidence that the organization remains fully reconciled after deletion.

### 12. Record deletion completion independently

Create or update the independent operational deletion record.

Record only the minimum information required for accountability and troubleshooting, including:

- deletion operation identifier
- organization identifier
- minimized organization reference where appropriate
- request date
- execution date
- requester/authorizer reference
- operator reference
- export status
- access-freeze timestamp
- quiescence confirmation
- pre-deletion inventory completion
- R2 deletion verification
- PostgreSQL deletion verification
- authentication verification
- neighboring-organization verification
- reconciliation result
- idempotent retry result
- completion status
- failure/retry information where applicable

Do not store deleted customer research content, attachment contents, credentials, raw authentication tokens, or production secrets in the deletion record.

The deletion record must remain independent of the deleted organization's foreign-key relationships.

### 13. Customer confirmation

After all production-deletion verification succeeds, the customer may be informed that:

- active production customer data has been deleted
- normal LabFlow workspace access has ended
- protected historical backup copies may temporarily remain
- historical backup copies will expire according to LabFlow's documented backup-retention schedule

Do not state that every backup copy has already been erased unless that has actually been verified.

### 14. Backup aging and restore reconciliation

Deletion of active production data does not immediately rewrite historical backups.

After deletion:

- new PostgreSQL backups must no longer contain the deleted active organization
- new attachment backups must no longer contain the deleted organization namespace
- older protected backups must age out according to the documented retention schedule

If a backup containing the deleted organization is restored:

- the restored organization must not be returned directly to active customer use
- the deletion record must be consulted
- the organization must be reconciled and deleted again before restored data is promoted to production
- the restored R2 state must also be checked for deleted organization objects

Backup restoration procedures must therefore preserve access to independent organization-deletion evidence.

### 15. Non-production drill script restriction

`scripts/organizationDeletionDrill.js` is a non-production verification tool.

It is designed to run only against:

- `NODE_ENV=test`
- the local `labflow_test` PostgreSQL database
- the dedicated `labflow-test-attachments` Cloudflare R2 bucket

The drill script must never be modified or used as an ad hoc production deletion command.

Production deletion must use the approved production operator mechanism and production configuration after all production safety prerequisites have been verified.

### 16. Stop conditions

The operator must stop the deletion procedure and investigate if any of the following occurs:

- authorization cannot be verified
- organization identity is ambiguous
- a preservation hold applies
- required export handling is unresolved
- production schema or migration status is uncertain
- deployed deletion code does not match the tested implementation
- the selected PostgreSQL environment is unexpected
- the selected R2 bucket is unexpected
- organization freeze cannot be verified
- upload quiescence has not elapsed
- R2 inventory contains unexpected namespace behavior
- R2 deletion cannot be verified
- PostgreSQL deletion fails
- reconciliation cannot reach a known safe state
- neighboring organization data changes unexpectedly
- post-deletion authentication remains possible
- deletion verification produces inconsistent results

A stopped or partially completed deletion must remain recorded as incomplete until reconciliation and verification are successfully completed.

## Review and Maintenance

This procedure should be reviewed:

- whenever a new organization-owned model is added
- whenever attachment storage behavior changes
- whenever database relationships or cascade behavior changes
- whenever the retention policy changes
- whenever backup restoration behavior changes
- whenever customer export behavior changes
- after any failed or partially completed organization deletion
