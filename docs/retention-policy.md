# Labfluss Data Retention Policy

**Version:** 1.0  
**Applies to:** Initial United States paid pilot program

## Purpose

This policy defines how long Labfluss retains customer, account, research, security, operational, and backup data during and after the initial paid pilot.

The objectives are to:

- retain customer data while it is needed to provide the service
- avoid indefinite retention of data that is no longer needed
- provide a reasonable period for customer export and offboarding
- preserve limited operational and security information where necessary
- allow backup copies to expire through controlled retention cycles
- support incident response and recovery
- align retention with the Labfluss Pilot Data Policy and Data Inventory

This policy does not override a stricter retention requirement agreed to in writing with a pilot customer.

## Implementation Requirement

Before this policy is applied to a paid pilot, Labfluss must verify that the production environment and operating procedures can satisfy the retention, deletion, backup, and offboarding commitments described in this document.

A retention period must not be represented to a customer as operationally guaranteed until the corresponding technical or manual procedure has been implemented and verified.

## Retention Principles

Labfluss follows these principles:

1. Customer Data is retained while the customer's pilot workspace remains active unless the customer deletes or archives information through supported application workflows.
2. Archive is not the same as permanent deletion.
3. When a pilot ends, the customer should have a defined period to request or receive an export before production data is permanently removed.
4. Operational and security records may have a different retention period from customer research content.
5. Backups are not modified record-by-record during normal deletion. Deleted production data disappears from backups as those backups expire according to their retention schedule.
6. Data should not be retained indefinitely without an operational, security, contractual, or recovery reason.
7. Prohibited data discovered in Labfluss may require accelerated containment or deletion under the Pilot Data Policy.
8. A legal, contractual, security, or incident-response preservation requirement may temporarily suspend normal deletion where necessary.

## Retention Schedule

| Data category                              | Retention while pilot is active                                             | Retention after pilot termination                                                | Notes                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Organization data                          | for duration of active workspace                                            | up to 30 days                                                                    | retained during offboarding/export window                               |
| User profile data                          | while account/workspace is active                                           | up to 30 days                                                                    | may be removed earlier as part of organization deletion                 |
| Projects                                   | until deleted under applicable lifecycle procedure or workspace termination | up to 30 days                                                                    | archived projects remain retained until deletion/offboarding            |
| Project memberships                        | while related workspace/project exists                                      | up to 30 days                                                                    | removed with associated organization data                               |
| Tasks                                      | until deleted under applicable lifecycle procedure or workspace termination | up to 30 days                                                                    | archive alone does not constitute deletion                              |
| Experiments                                | until deleted under applicable lifecycle procedure or workspace termination | up to 30 days                                                                    | archive alone does not constitute deletion                              |
| Protocols/SOPs                             | until deleted under applicable lifecycle procedure or workspace termination | up to 30 days                                                                    | archive alone does not constitute deletion                              |
| Equipment records                          | while workspace remains active                                              | up to 30 days                                                                    | removed during organization offboarding                                 |
| Equipment bookings                         | while workspace remains active                                              | up to 30 days                                                                    | removed during organization offboarding                                 |
| Notebook entries                           | while related experiment/project/workspace remains active                   | up to 30 days                                                                    | removed with associated customer data                                   |
| Review history                             | while related customer records remain active                                | up to 30 days                                                                    | customer workflow data                                                  |
| Attachment metadata                        | while attachment or related customer record is retained                     | up to 30 days                                                                    | metadata and object deletion should be reconciled                       |
| Attachment file contents                   | while attachment or related customer record is retained                     | up to 30 days                                                                    | private R2 objects                                                      |
| Archived customer records                  | while workspace remains active unless permanently deleted                   | up to 30 days                                                                    | archive is a recoverable application state                              |
| Invitations                                | while pending and for limited administrative history afterward              | up to 90 days after expiration, revocation, acceptance, or workspace termination | raw invitation tokens are not retained as plaintext                     |
| Password-reset token data                  | only while required for the reset/security workflow                         | no intentional post-account retention                                            | raw reset tokens are not persisted                                      |
| Email-verification token data              | only while required for the verification/security workflow                  | no intentional post-account retention                                            | raw verification tokens are not persisted                               |
| Password hashes and account-security state | while account exists                                                        | removed with account, subject to backup expiration                               | Security-Sensitive                                                      |
| JWT access tokens                          | until expiration or invalidation                                            | not retained as server-side session records unless otherwise documented          | browser-held bearer credential                                          |
| Audit records                              | while workspace is active                                                   | up to 180 days after termination                                                 | limited retention supports security and incident investigation          |
| Application logs                           | normally no more than 30 days from creation                                 | same age-based retention applies after termination                               | sanitized logs only; provider capabilities may impose shorter retention |
| Monitoring and uptime history              | up to 90 days from creation                                                 | same age-based retention applies after termination                               | service-level operational information                                   |
| Transactional email delivery metadata      | while needed for delivery troubleshooting                                   | up to 90 days                                                                    | excludes raw authentication credentials                                 |
| Transactional email message/provider data  | according to configured provider retention                                  | should be minimized and removed according to provider capabilities               | provider-specific retention documented separately                       |
| Database backups                           | according to backup schedule                                                | expire through normal backup retention cycle                                     | backups are Security-Sensitive                                          |
| Attachment backups                         | according to backup schedule                                                | expire through normal backup retention cycle                                     | backups are Confidential                                                |
| Production configuration metadata          | while infrastructure is in use and as needed for recovery documentation     | as long as operationally required                                                | should not contain plaintext secrets in documentation                   |
| Production secrets                         | only while required for active systems                                      | revoked or destroyed when no longer required                                     | old credentials should not be retained unnecessarily                    |

## Active Customer Data

While a pilot workspace is active, Labfluss retains the customer data needed to provide the service.

This includes:

- organization information
- users
- projects
- tasks
- experiments
- protocols
- equipment
- bookings
- notebook entries
- review history
- attachments
- other related workspace information

The customer may archive supported resources as part of normal application use.

Archived records remain stored and recoverable. Archiving does not constitute permanent deletion.

## Pilot Termination and Offboarding

When a paid pilot ends, Labfluss should provide a 30-day offboarding window unless another period is agreed in writing.

During that period:

- the customer's workspace should no longer be treated as an indefinitely active production account
- the customer may request an available data export
- Labfluss may coordinate data verification and offboarding
- customer data remains protected by the same access and security requirements that applied during the active pilot

Customer production data may be removed earlier at the customer's request where operationally feasible. In all cases, customer production data should be permanently removed no later than the end of the 30-day offboarding period unless:

- the customer and Labfluss agree in writing to extend retention
- a legal or contractual preservation requirement applies
- retention is temporarily necessary for investigation of a security incident

Backup copies may continue to contain the deleted information until the applicable backup retention periods expire.

## Account Removal During an Active Pilot

Removing or disabling an individual user does not necessarily require immediate deletion of all records associated with that user.

For example, project assignments, experiment authorship, review history, equipment bookings, audit events, and other historical records may need to preserve the identity of the actor or contributor while the organization's workspace remains active.

The user's ability to authenticate should be removed when access is terminated.

Personal profile information should be minimized where practical without corrupting the integrity of retained laboratory or audit records.

The detailed user-removal procedure should be defined as part of organization offboarding and deletion implementation.

## Archived Records

Labfluss currently supports archive/recovery workflows for supported resource types.

Archived records:

- remain stored in PostgreSQL
- remain subject to normal authorization controls
- may remain associated with attachment objects
- retain the same data classification as their active counterparts
- are not considered permanently deleted merely because they are hidden from normal active views

Permanent deletion must use a separate deletion or organization-offboarding process.

## Authentication and Security Data

### Passwords

Labfluss stores password hashes rather than plaintext passwords.

Password hashes are retained only while the associated user account exists and while required in backups that have not yet expired.

### Password Reset and Verification

Raw password-reset and email-verification tokens are not retained as normal database values.

Stored token hashes and related expiration/security state should remain only as long as necessary to operate or validate the corresponding authentication workflow.

Expired or consumed authentication credentials must not remain valid.

### JWTs

JWT bearer tokens expire according to the configured authentication lifetime and may also become invalid through `tokenVersion` session invalidation.

Labfluss does not treat an expired or invalidated JWT as customer data that must be retained.

## Invitations

Invitation records may contain:

- invited email address
- intended role
- organization association
- invitation status
- expiration information
- hashed token data
- email-delivery metadata

Raw invitation tokens are not retained in plaintext by the application.

Pending invitation information may be retained while the invitation remains actionable.

Accepted, expired, or revoked invitation metadata may be retained for up to 90 days for administrative troubleshooting, onboarding history, and security review, after which it should be eligible for deletion unless longer retention is required for an active investigation.

## Audit Records

Audit records support:

- security investigation
- administrative accountability
- troubleshooting
- reconstruction of important administrative or review activity

For the initial pilot, relevant audit records may be retained during the active customer relationship and for up to 180 days following pilot termination for security, accountability, troubleshooting, and incident-investigation purposes.

Audit retention does not authorize retention of unrestricted copies of deleted customer research content.

Where practical, retained audit records should identify actions and resources without unnecessarily duplicating the underlying content.

## Application Logs

Production application logs are intended for:

- troubleshooting
- security monitoring
- incident investigation
- deployment verification
- operational diagnostics

The target retention period for application logs is no more than 30 days unless a specific incident requires temporary preservation.

Logs must remain sanitized according to Labfluss security requirements.

Logs must not intentionally contain:

- passwords
- bearer tokens
- raw password-reset tokens
- raw verification tokens
- raw invitation tokens
- DATABASE_URL values
- provider API credentials
- R2 credentials
- signed attachment URLs
- unrestricted customer attachment contents

If the hosting provider's plan retains logs for a shorter period, the shorter provider retention applies.

## Monitoring Data

Service availability and monitoring history may be retained for up to 90 days for operational analysis, troubleshooting, and pilot reliability review.

Monitoring systems should not receive customer research content.

## Transactional Email

Labfluss sends transactional email for workflows such as:

- invitations
- password reset
- email verification

Labfluss should retain application-side delivery metadata only as long as needed for troubleshooting and operational history, with a target maximum of 90 days after the relevant message or workflow is no longer active.

The external email provider may maintain its own delivery logs or message metadata according to its configured service capabilities and provider policies.

Provider-specific retention should be recorded in the Labfluss subprocessor inventory.

## Database Backup Retention

Production database backups contain Confidential customer information and Security-Sensitive authentication data.

They must therefore be protected as Security-Sensitive.

For the initial paid pilot, the verified production database backup configuration includes:

- Amazon RDS automated backups
- 7-day automated backup retention
- point-in-time recovery within the retained backup window
- manual DB snapshots for selected known-good recovery points
- portable PostgreSQL logical backups for additional recovery portability

Longer-lived backup copies may be retained only where operational, contractual, migration, or incident-response requirements justify them.

Amazon RDS point-in-time recovery is limited to the configured automated-backup retention window.

Manual pre-migration or incident-related recovery snapshots may temporarily be retained outside the normal schedule until the associated deployment or incident has been verified as resolved.

Backup retention must be implemented consistently with the Labfluss Backup and Recovery documentation.

## Attachment Backup Retention

Attachment backups contain customer research data and are classified as Confidential.

For the initial paid pilot:

- attachment backups should be created on an automated schedule
- routine attachment backup copies should be retained for no more than 30 days
- backup deletion should occur through normal backup expiration rather than attempting record-by-record mutation of historical backup sets
- backup access should remain limited to authorized recovery operations

A longer retention period may be established where a pilot contract or recovery requirement explicitly requires it.

## Deletion From Backups

When production customer data is deleted, Labfluss does not need to locate and surgically remove the same record from every historical backup immediately.

Instead:

1. the data is removed from the active production systems
2. no new backup should contain the deleted production data after deletion completes
3. pre-existing backup copies remain protected and inaccessible for ordinary application use
4. those copies expire according to the normal backup retention schedule
5. restored historical backups must not be used to reintroduce data that should already have been deleted without appropriate reconciliation

This approach preserves backup integrity while still placing an upper bound on residual retention.

## Prohibited Data

The Labfluss Pilot Data Policy continues to apply regardless of the normal retention periods in this document.

If prohibited data is discovered:

- normal retention periods do not require Labfluss to keep it
- access should be restricted where practical
- appropriate containment and deletion actions should be determined
- sufficient incident records may be preserved without unnecessarily retaining the prohibited content itself
- backup copies should expire according to the applicable backup process unless a different response is required by law, contract, or incident handling

## Legal, Contractual, and Incident Holds

Normal deletion may be temporarily suspended where retention is reasonably necessary for:

- a security investigation
- fraud or abuse investigation
- legal process
- contractual dispute
- preservation requirement
- customer-requested incident investigation

Any such exception should be limited to the data actually required and should end when the preservation reason no longer applies.

The existence of this exception does not authorize indefinite retention.

## Customer-Specific Retention Requirements

A university may require a different retention period as part of a pilot agreement.

Labfluss should not accept a customer-specific retention requirement unless the production architecture and operating procedures can actually satisfy it.

Where the pilot agreement establishes a stricter retention or deletion requirement than this policy, the agreed requirement applies.

## Policy Review

This policy should be reviewed:

- before the first paid pilot begins
- when backup architecture materially changes
- when organization deletion is implemented or changed
- when customer export functionality is introduced
- when log or monitoring providers change
- when provider retention settings change materially
- when a pilot agreement establishes different retention requirements
- following a security incident that identifies a retention gap
