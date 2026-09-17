# Labfluss Subprocessor Inventory

**Version:** 1.0
**Applies to:** Initial United States paid pilot program
**Review frequency:** Before the first paid pilot, when a provider changes, and at least annually

## Purpose

This document identifies third-party service providers that may process Labfluss customer data or customer-related operational data in connection with providing the Labfluss service.

For the initial paid pilot, university customers generally determine the purposes of processing their laboratory and user data. Labfluss processes that data to provide the service. Where Labfluss acts as a processor on behalf of the customer, the third-party providers identified in this document may act as Labfluss subprocessors.

The exact legal role of each party depends on the applicable customer agreement and the type of data being processed.

This inventory should be read together with:

- `pilot-data-policy.md`
- `data-inventory.md`
- `retention-policy.md`
- `customer-data-export.md`
- `organization-offboarding.md`
- the applicable Labfluss customer agreement and privacy documentation

## Scope

This inventory covers providers that directly support production Labfluss operations and may receive:

- customer user information
- laboratory workflow data
- research-related application content permitted by the Pilot Data Policy
- attachments
- transactional-email information
- network/request metadata
- application or infrastructure monitoring information

A provider is not included merely because Labfluss developers use that provider for development purposes.

For example, a source-code hosting service that receives no production customer data is not automatically a production customer-data subprocessor.

## Downstream Provider Subprocessors

Some Labfluss providers use their own infrastructure providers and other subprocessors.

Those downstream organizations are not normally direct Labfluss vendors.

Labfluss therefore maintains:

1. this inventory of direct Labfluss service providers; and
2. references to each direct provider's maintained subprocessor list where available.

Labfluss should not copy a provider's entire changing subprocessor list into this document unless there is a specific contractual or operational reason to do so.

Provider-maintained lists should be reviewed periodically and before material production changes.

---

## 1. Amazon Web Services

### Service

Production infrastructure, application hosting, relational database storage, private object storage, and transactional-email delivery.

### Labfluss use

Amazon Web Services currently provides five core production services used by Labfluss:

- AWS Amplify Hosting for the React/Vite frontend
- AWS Lightsail for the Node.js/Express backend API
- Amazon RDS for PostgreSQL for the production relational database
- Amazon S3 for private production attachment storage
- Amazon SES for production transactional-email delivery

### Data potentially processed

The AWS services may process different categories of Labfluss customer or operational data depending on their function.

AWS Amplify Hosting may process:

- IP addresses
- user agents
- request URLs
- timestamps
- network and security telemetry
- compiled frontend assets

Labfluss does not intentionally place database credentials, backend secrets, or ordinary customer records into frontend build artifacts.

AWS Lightsail may process:

- organization identifiers
- user account information
- names and email addresses
- projects
- tasks
- experiments
- protocols
- equipment information
- bookings
- notebook entries
- review information
- invitation information
- attachment metadata
- authorization and session-related request information
- request metadata
- sanitized application logs

Attachment binaries normally upload directly between the browser and Amazon S3 using short-lived signed URLs rather than passing through the Lightsail backend during normal upload.

Amazon RDS for PostgreSQL stores the primary structured Labfluss customer dataset, including:

- organizations
- users
- password hashes
- account-security state
- projects
- project memberships
- tasks
- experiments
- protocols
- equipment
- equipment bookings
- notebook entries
- review events
- invitations
- token hashes
- attachment metadata
- audit records
- archived customer records

Amazon S3 stores private customer attachment binaries, including:

- research attachments
- project attachments
- task attachments
- experiment attachments
- protocol attachments
- equipment attachments
- object metadata
- organization-scoped storage identifiers

Attachment metadata is primarily stored in PostgreSQL, while raw attachment binaries are stored in Amazon S3.

Amazon SES may process:

- recipient name
- recipient email address
- sender information
- email subject
- email body
- delivery metadata
- timestamps
- one-time invitation URLs
- one-time email-verification URLs
- one-time password-reset URLs

Because one-time URLs contain temporary authentication or account-recovery tokens, those token values exist within the email message transmitted through Amazon SES even though Labfluss stores only token hashes in PostgreSQL.

### Purpose

- frontend hosting and static asset delivery
- backend/API hosting and execution
- persistent relational database storage
- database backup and recovery
- private object storage and delivery of customer attachments
- transactional account and authentication email delivery

### Provider role

Subprocessor where AWS processes customer personal data on behalf of Labfluss in connection with providing the service.

### Data location

The current production AWS infrastructure is deployed in the Europe (Frankfurt) Region where applicable.

Current verified production configuration includes:

- Amplify production frontend serving `https://app.labfluss.com`
- Lightsail backend instance in Frankfurt
- Amazon RDS PostgreSQL DB instance `labflow-production` in `eu-central-1`
- Amazon S3 production attachment bucket `labfluss-attachments-production` in `eu-central-1`
- private Lightsail-to-RDS connectivity
- RDS publicly accessible: No
- S3 public access blocked
- Amazon SES production transactional-email service in `eu-central-1`

AWS identifies Europe (Frankfurt) as Region `eu-central-1` in Germany.

The production S3 attachment bucket is located in `eu-central-1`.

If a customer requires explicit US-only object-storage residency, the current `eu-central-1` production bucket must not be represented as meeting that requirement.

Amazon SES production access was approved in the Europe (Frankfurt) Region. Labfluss uses Amazon SES in `eu-central-1` for production invitation, password-reset, and email-verification delivery.

Customer-data residency should not be described more broadly than the verified service configuration and applicable AWS service terms.

### Contractual/privacy documentation

AWS publishes an AWS Data Processing Addendum governing the processing of Customer Data through covered AWS services.

The AWS services used by Labfluss, including Amazon RDS, Amazon S3, Amazon SES, AWS Lightsail, and AWS Amplify Hosting, are governed by the applicable AWS service terms and data-processing documentation.

AWS also maintains official subprocessor information. The subprocessors relevant to an individual customer may depend on the AWS services and Regions used.

### Downstream subprocessors

Use the AWS-maintained subprocessor information rather than copying the complete changing list into this document.

AWS states that it updates its subprocessor information before engaging a new subprocessor and provides an update-notification mechanism.

Review the current AWS subprocessor information before the first paid pilot and monitor provider changes.

### Labfluss safeguards

General AWS safeguards used by Labfluss include:

- TLS for frontend and backend traffic
- Nginx HTTPS reverse proxy
- systemd-supervised backend service
- production environment validation
- sensitive-value log redaction
- no raw authentication/reset/verification tokens in logs
- organization authorization and tenant isolation
- no backend secrets embedded in frontend build artifacts

Amazon RDS safeguards include:

- private-only production database
- private Lightsail-to-RDS connectivity
- Amazon RDS TLS with certificate verification
- encrypted RDS storage
- 7-day RDS automated backup retention
- manual RDS snapshot capability

Amazon S3 safeguards include:

- private production attachment bucket
- public access blocked
- `BucketOwnerEnforced` object ownership
- SSE-S3 default encryption using `AES256`
- organization-scoped storage namespace
- short-lived signed uploads and downloads
- signed upload content-length enforcement
- content validation
- file-signature validation
- OOXML validation
- staging/final separation
- ETag-conditioned finalization
- attachment authorization
- organization deletion and reconciliation controls
- customer export integrity checking
- dedicated least-privilege production IAM credential
- account-wide bucket enumeration denied

Amazon SES safeguards include:

- verified `labfluss.com` sending identity
- DKIM
- custom MAIL FROM
- SPF
- DMARC
- account-level bounce/complaint suppression
- dedicated least-privilege SES sending credentials
- raw invitation/reset/verification tokens are not stored in PostgreSQL
- production API responses do not expose raw invitation links
- transactional-email delivery verified for invitation, password-reset, and email-verification workflows

### Pilot status

**PRODUCTION INFRASTRUCTURE, LEGAL/SUBPROCESSOR REVIEW, AND S3 CORS HARDENING VERIFIED**

Completed before first pilot:

- current AWS Data Processing Addendum reviewed
- current AWS subprocessor information reviewed
- AWS subprocessor-change notifications enabled
- production S3 localhost origin removed
- production attachment upload, download/open, and archive behavior verified after the CORS change

Remaining:

- confirm customer-specific data-location requirements against the actual AWS services and Regions used before onboarding a customer with specific residency requirements

---

## 2. Mailgun / Sinch Email, Former Production Provider

### Service

Former production transactional-email provider. Mailgun is no longer configured or authorized for Labfluss production use.

### Labfluss use

Mailgun was the Labfluss production transactional-email provider before the Amazon SES cutover.

It previously delivered:

- organization invitations
- email-verification messages
- password-reset messages

Amazon SES is now the active production provider.

Mailgun is not used for normal production transactional-email delivery while `EMAIL_PROVIDER=ses`.

The previous Mailgun production configuration has been retired. Production environment variables were removed, the Labfluss Mailgun sending credential was revoked, and obsolete rollback material was deleted.

### Data potentially processed

During its period as the active production provider, Mailgun could process:

- recipient name
- recipient email address
- sender information
- email subject
- email body
- delivery metadata
- timestamps
- one-time invitation URLs
- one-time email-verification URLs
- one-time password-reset URLs

Mailgun is not authorized for current Labfluss production processing. Any future reactivation would require a new security, privacy, legal, retention, and subprocessor review before customer data could be transmitted through it.

Because one-time URLs contain authentication or recovery tokens, transactional-email handling remains security-sensitive even though Labfluss stores only token hashes in PostgreSQL.

### Purpose

Historical production transactional-email delivery before the Amazon SES migration.

### Provider role

Former production subprocessor.

Mailgun is no longer an active Labfluss production subprocessor. It would become a subprocessor again only if intentionally reintroduced for production processing after a new review.

### Contractual/privacy documentation

Mailgun is operated as part of Sinch Email.

Mailgun's contractual, privacy, DPA, and subprocessor documentation was reviewed while it was the active Labfluss production email provider.

If Mailgun is intentionally retained or reactivated for a paid pilot, the applicable documentation must be reviewed again before customer data is transmitted through it.

### Data location

The historical Labfluss Mailgun account and sending configuration use the United States region.

Historical production configuration used the Mailgun US API endpoint.

Mailgun region information is retained only for historical traceability and must not be interpreted as the current Labfluss transactional-email data location.

The active production email provider is Amazon SES in `eu-central-1`.

### Retention

The previously reviewed Mailgun Free account showed:

- dashboard log retention: 1 day
- message-body retention: unavailable on the reviewed plan

These values describe the previously reviewed Mailgun configuration and should be reverified if Mailgun is reactivated.

### Labfluss safeguards

- raw token values are not stored in PostgreSQL
- invitation/reset/verification tokens are cryptographically generated
- only token hashes are stored in the application database
- links expire
- replacement links invalidate earlier links
- production responses do not expose raw invitation links
- email-provider message identifiers are excluded from customer-facing responses and customer exports
- email service failures do not corrupt application transaction state
- Mailgun is not selected during normal production operation while Amazon SES is healthy

### Pilot status

**FORMER PRODUCTION PROVIDER, FULLY RETIRED**

The preferred Phase 26C.5 retirement path was completed after final SES verification. Mailgun production environment variables were removed, the Labfluss Mailgun credential was revoked, obsolete rollback material was deleted, and Amazon SES remained healthy during final production verification.

---

## 3. Better Stack

### Service

External uptime/readiness monitoring and operational alerting.

### Labfluss use

Better Stack monitors production availability, including Labfluss health/readiness endpoints.

Current monitoring is intended to observe service availability rather than ingest customer research data.

### Data potentially processed

Expected data is limited primarily to:

- monitored endpoint URLs
- HTTP response status
- response time
- generic health/readiness response bodies
- timestamps
- service availability incidents
- operator/account information

The monitored Labfluss health endpoints must remain free of customer records, credentials, secrets, database connection information, and other sensitive content.

### Purpose

Availability monitoring and operational alerting.

### Provider role

Operational subprocessor/service provider.

### Data location

The current Better Stack configuration uses its EU/Germany data-region posture for control-plane and incident log-snippet handling.

Labfluss currently uses Better Stack only for external uptime monitoring and does not intentionally ingest application logs, research data, or frontend session telemetry.

### Contractual/privacy documentation

Better Stack publishes a Data Processing Addendum covering Customer Personal Data processed through its services.

The current Better Stack DPA and authorized subprocessor schedule have been reviewed.

The current authorized subprocessor schedule includes infrastructure, support, communications, analytics, and AI service providers.

Because Labfluss currently uses Better Stack only for uptime monitoring, the operational data exposed to Better Stack is intentionally limited.

The "Explain with AI and AI summaries" feature is disabled to avoid unnecessary AI processing of incident data.

### Labfluss safeguards

- public liveness endpoint contains generic status only
- readiness endpoint exposes availability state without database credentials or customer content
- monitoring does not intentionally receive research records
- sanitized operational logging

### Pilot status

**CONFIGURATION, SECURITY HARDENING, AND SUBPROCESSOR CHANGE PROCESS VERIFIED**

Completed before first pilot:

- "Allow Explain with AI and AI summaries" disabled
- account two-factor authentication enabled
- organization-wide two-factor authentication requirement enabled

Subprocessor change monitoring:

- Better Stack confirmed on 2026-09-16 that it does not currently provide a mailing list or automated subscription for subprocessor changes
- the current authorized subprocessor schedule is published under Schedule A of the Better Stack DPA
- the schedule includes a "Last Updated" date that can be used to identify changes
- Labfluss will review the Better Stack subprocessor schedule periodically as part of its provider-review process

---

## 4. Google Workspace

### Service

Operational business email and monitored security/privacy contact mailboxes.

### Labfluss use

Google Workspace provides the primary human-operated Labfluss business mailbox:

- `admin@labfluss.com`

The following monitored aliases route to that mailbox:

- `security@labfluss.com`
- `privacy@labfluss.com`

External delivery to both aliases was verified on 2026-09-16.

Google Workspace is separate from Amazon SES. Amazon SES remains the production transactional-email provider used by the Labfluss application for invitations, password resets, and email verification.

### Data potentially processed

Google Workspace may process customer, prospect, or operational correspondence including:

- names
- email addresses
- message subjects
- message bodies
- support correspondence
- security inquiries
- privacy inquiries
- attachments voluntarily sent by correspondents
- timestamps
- email-delivery metadata
- administrator/account information

Customer research records and application data are not intentionally routed through Google Workspace as part of normal Labfluss application operation.

### Purpose

- business correspondence
- pilot/customer communication
- security contact
- privacy contact
- provider and compliance correspondence
- operational administration

### Provider role

Operational service provider and potential subprocessor where customer personal data is contained in correspondence processed through Google Workspace.

### Data location

The current Labfluss Google Workspace subscription is Business Starter.

Labfluss must not represent Google Workspace email data as guaranteed to remain exclusively in the EU under the current subscription.

Any customer-specific data-residency requirement must be evaluated separately before onboarding.

### Contractual/privacy documentation

The Google Workspace Cloud Data Processing Addendum (CDPA) was accepted by the Labfluss administrator on 2026-09-16.

Google maintains its own subprocessor information for Google Workspace.

The separate Google Admin option for customers with billing addresses outside Europe, the Middle East, and Africa to indicate that EU Data Protection Law applies was not selected because the current Labfluss billing context is Germany/EMEA.

The HIPAA Business Associate Amendment has not been accepted because it is not part of the current pilot scope.

### Labfluss safeguards

- dedicated Labfluss Workspace account
- monitored `admin@labfluss.com` mailbox
- dedicated security and privacy aliases
- external delivery to security and privacy aliases tested successfully
- Google Workspace CDPA accepted
- transactional application email remains isolated to Amazon SES
- customer research data is not intentionally routed through Workspace
- access should remain restricted to authorized Labfluss operators

### Pilot status

**OPERATIONAL EMAIL CONFIGURATION AND BILLING VERIFICATION COMPLETED**

Completed:

- domain verified
- Gmail activated
- `admin@labfluss.com` operational
- `security@labfluss.com` alias configured and externally tested
- `privacy@labfluss.com` alias configured and externally tested
- Cloud Data Processing Addendum accepted
- Google Workspace bank account verification completed on 2026-09-17
- verified bank account confirmed as the primary payment method
- Google Workspace payment account confirmed in use
- previous billing/payment verification warning confirmed cleared on 2026-09-17

---

## Provider Change Management

Before introducing a new production provider that may process customer data:

1. identify the service and purpose
2. identify the customer data that could be processed
3. determine whether the provider acts as a processor/subprocessor
4. review applicable privacy/security documentation
5. review the provider's DPA where required
6. review data location
7. review retention and deletion behavior
8. review downstream subprocessors
9. evaluate security controls
10. update this inventory
11. update customer-facing disclosures where required
12. obtain contractual approval where required before transmitting customer data

A new provider must not receive pilot customer data solely because it is technically convenient.

---

## Subprocessor Change Monitoring

Where providers offer subprocessor-change notifications, Labfluss should subscribe to them.

At minimum, the operator should review this inventory:

- before the first paid pilot
- before onboarding a customer with specific data-location requirements
- when changing production providers
- after receiving a provider subprocessor-change notice
- during annual privacy/security review

---

## Providers Not Currently Classified as Production Customer-Data Subprocessors

### GitHub

GitHub hosts Labfluss source code.

Production customer records and production secrets must not be committed to the repository.

Provided that this boundary is maintained, GitHub is not currently classified as a processor of Labfluss pilot customer content for the purposes of this inventory.

If production logs, database exports, customer attachments, support tickets containing customer data, or production secrets begin to be stored in GitHub, this classification must be revisited.

### Local development tools

Developer editors, local test databases, and isolated test storage are not production customer-data subprocessors.

Production customer data must not be copied into local development/test environments merely for convenience.

---

## Customer Disclosure

The initial paid-pilot agreement or privacy documentation should identify the applicable Labfluss subprocessors or provide a maintained reference to this inventory.

A customer should be able to understand:

- who processes its data
- why the provider is used
- what broad category of data may be processed
- relevant location information
- how material provider changes will be handled

Labfluss should not promise a specific provider, region, or downstream subprocessor arrangement unless that configuration has been verified and can be maintained contractually.

---

## Pre-Pilot Verification Checklist

The following items remain configuration-specific and must be verified before the first paid pilot:

### Amazon Web Services

- [x] AWS Amplify production frontend identified
- [x] production custom frontend domain recorded: `https://app.labfluss.com`
- [x] AWS Lightsail production backend identified: `labflow-backend-production`
- [x] Lightsail production region recorded: Frankfurt
- [x] production API domain recorded: `https://api.labfluss.com`
- [x] Amazon RDS production DB instance identified: `labflow-production`
- [x] production database identified: `labflow`
- [x] PostgreSQL version recorded: 17.11
- [x] RDS region recorded: `eu-central-1`
- [x] RDS instance class recorded: `db.t4g.micro`
- [x] RDS storage recorded: 20 GiB gp3
- [x] RDS encryption at rest confirmed enabled
- [x] automated backups confirmed enabled
- [x] backup retention confirmed: 7 days
- [x] post-cutover manual DB snapshot created
- [x] RDS publicly accessible confirmed: No
- [x] private Lightsail-to-RDS connectivity verified
- [x] production health endpoint confirmed: `/api/health`
- [x] production readiness endpoint confirmed: `/api/ready`
- [x] attachment-cleanup systemd timer enabled and active
- [x] review current AWS Data Processing Addendum before paid pilot
- [x] review current AWS subprocessor list before paid pilot
- [x] subscribe to AWS subprocessor-change notifications
- [ ] confirm customer-specific data-location requirements against the actual AWS services and Regions used
- [x] Amazon S3 production bucket identified: `labfluss-attachments-production`
- [x] S3 production region recorded: `eu-central-1`
- [x] S3 public access blocked
- [x] S3 Object Ownership confirmed: `BucketOwnerEnforced`
- [x] S3 default encryption confirmed: SSE-S3 (`AES256`)
- [x] S3 CORS policy reviewed
- [x] S3 allowed production origin recorded: `https://app.labfluss.com`
- [x] production S3 localhost origin removed before pilot
- [x] production attachment upload verified after CORS change
- [x] production attachment download/open verified after CORS change
- [x] production attachment archive verified after CORS change
- [x] S3 allowed methods recorded: GET, PUT, HEAD
- [x] production IAM credential restricted to required attachment operations
- [x] account-wide bucket enumeration denied
- [x] Amazon SES identified as the active production transactional-email provider
- [x] SES production region recorded: `eu-central-1`
- [x] SES production access approved on 2026-09-09
- [x] SES account confirmed outside the production sandbox
- [x] `labfluss.com` production sending identity configured
- [x] DKIM configured
- [x] custom MAIL FROM configured
- [x] SPF configured
- [x] DMARC configured
- [x] account-level bounce/complaint suppression configured
- [x] dedicated least-privilege SES sending credential configured
- [x] production password-reset delivery verified through SES
- [x] production email-verification delivery verified through SES
- [x] production administrator-invitation delivery verified through SES
- [x] backend delivery logs verified with provider `ses`

### Mailgun / Sinch Email, Former Production Provider

- [x] Mailgun confirmed not active for normal production delivery
- [x] SES post-cutover rollback window formally closed
- [x] Remaining Mailgun production environment variables removed
- [x] Labfluss Mailgun credential revoked
- [x] Protected rollback material containing obsolete Mailgun credentials removed
- [x] Final SES verification performed after Mailgun removal
- [x] Mailgun marked fully retired from production

### Better Stack

- [x] production monitoring provider identified: Better Stack Uptime
- [x] current plan recorded: Free
- [x] frontend uptime monitor confirmed
- [x] backend liveness monitor confirmed: `/api/health`
- [x] backend readiness monitor confirmed: `/api/ready`
- [x] monitoring scope confirmed as external availability monitoring
- [x] monitor regions reviewed: Europe, North America, Asia, Australia
- [x] no custom authorization headers configured
- [x] no HTTP Basic Authentication configured
- [x] no monitoring proxy configured
- [x] no application-log ingestion observed
- [x] no frontend session-replay/browser telemetry observed
- [x] reporting confirmed disabled
- [x] audit-log export confirmed disabled
- [x] control-plane/log-snippet location identified as Germany
- [x] DPA/security posture reviewed
- [x] current Better Stack DPA reviewed
- [x] current Better Stack authorized subprocessor list reviewed
- [x] disable "Allow Explain with AI and AI summaries" before paid pilot
- [x] enable account 2FA
- [x] enable organization-wide 2FA requirement before paid pilot
- [x] review subprocessor-change notification mechanism
  - Better Stack confirmed on 2026-09-16 that no mailing list or automated subprocessor-change subscription is currently available
  - Schedule A of the Better Stack DPA is the maintained reference and includes a "Last Updated" date
  - periodic manual review adopted as the Labfluss monitoring control

### Google Workspace

- [x] Google Workspace identified as the operational business-email provider
- [x] `admin@labfluss.com` mailbox operational
- [x] `security@labfluss.com` alias configured and externally tested
- [x] `privacy@labfluss.com` alias configured and externally tested
- [x] Google Workspace Cloud Data Processing Addendum accepted
- [x] complete Google Workspace billing/payment verification
- [x] confirm Google Workspace billing warning is cleared before first paid pilot

---

## Review Record

**Last reviewed:** 2026-09-17

**Next review:** Before first paid pilot or upon material provider change, whichever occurs first.

**Status:** Production provider inventory reviewed during Phase 26D.6 paid-pilot readiness. AWS DPA and subprocessor materials were reviewed, AWS subprocessor-change notifications were enabled, and production S3 localhost CORS access was removed and retested successfully. Better Stack account and organization-wide 2FA are enabled and AI summaries are disabled; Better Stack confirmed that no automated subprocessor-change notification subscription is currently available, so periodic review of Schedule A of its DPA has been adopted as the monitoring control. Google Workspace operational email, security/privacy aliases, CDPA acceptance, bank-account verification, and billing/payment configuration have been verified. Customer-specific data-location requirements remain to be evaluated when applicable to an actual pilot customer.
