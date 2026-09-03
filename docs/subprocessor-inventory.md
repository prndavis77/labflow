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

Production infrastructure and application hosting.

### Labfluss use

Amazon Web Services currently provides three core production services used by Labfluss:

- AWS Amplify Hosting for the React/Vite frontend
- AWS Lightsail for the Node.js/Express backend API
- Amazon RDS for PostgreSQL for the production relational database

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

Attachment binaries normally upload directly between the browser and Cloudflare R2 using short-lived signed URLs rather than passing through the Lightsail backend during normal upload.

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

Raw attachment binaries are stored in Cloudflare R2 rather than Amazon RDS.

### Purpose

- frontend hosting and static asset delivery
- backend/API hosting and execution
- persistent relational database storage
- database backup and recovery

### Provider role

Subprocessor where AWS processes customer personal data on behalf of Labfluss in connection with providing the service.

### Data location

The current production AWS infrastructure is deployed in the Europe (Frankfurt) Region where applicable.

Current verified production configuration includes:

- Amplify production frontend serving `https://app.labfluss.com`
- Lightsail backend instance in Frankfurt
- Amazon RDS PostgreSQL DB instance `labflow-production` in `eu-central-1`
- private Lightsail-to-RDS connectivity
- RDS publicly accessible: No

AWS identifies Europe (Frankfurt) as Region `eu-central-1` in Germany.

Amazon RDS supports Europe (Frankfurt), `eu-central-1`.

Customer-data residency should not be described more broadly than the verified service configuration and applicable AWS service terms.

### Contractual/privacy documentation

AWS publishes an AWS Data Processing Addendum governing the processing of Customer Data through covered AWS services.

AWS also maintains an official subprocessor list. AWS states that subprocessors relevant to an individual customer depend on the AWS Region selected and the AWS services used.

### Downstream subprocessors

Use the AWS-maintained subprocessor list rather than copying the complete changing list into this document.

AWS states that it updates the subprocessor page before engaging a new subprocessor and provides an update-notification mechanism.

### Labfluss safeguards

- TLS for frontend and backend traffic
- Nginx HTTPS reverse proxy
- systemd-supervised backend service
- production environment validation
- sensitive-value log redaction
- no raw authentication/reset/verification tokens in logs
- organization authorization and tenant isolation
- private-only Amazon RDS production database
- private Lightsail-to-RDS connectivity
- Amazon RDS TLS with certificate verification
- encrypted RDS storage
- 7-day RDS automated backup retention
- manual RDS snapshot capability
- private Cloudflare R2 attachment storage
- no backend secrets embedded in frontend build artifacts

### Pilot status

**PRODUCTION INFRASTRUCTURE CONFIGURATION VERIFIED, AWS LEGAL/SUBPROCESSOR REVIEW REQUIRED BEFORE FIRST PAID PILOT**

Before first pilot:

- review the current AWS Data Processing Addendum
- review the current AWS subprocessor list
- subscribe to AWS subprocessor-change notifications
- confirm the AWS account/service terms applicable to the production configuration
- confirm any customer-specific data-location requirements against the actual AWS services and Regions used

---

## 2. Cloudflare

### Service

Cloudflare R2 object storage.

### Labfluss use

Cloudflare R2 stores private customer attachment binaries.

### Data potentially processed

R2 may store:

- research attachments
- project attachments
- task attachments
- experiment attachments
- protocol attachments
- equipment attachments
- object metadata
- organization-scoped storage identifiers

Attachment metadata is primarily stored in PostgreSQL.

### Purpose

Private object storage and delivery of customer attachments.

### Provider role

Subprocessor.

### Data location

The production Cloudflare R2 bucket is:

- `labflow-attachments`

The bucket location is:

- Eastern Europe (EEUR)

The production bucket's public development URL is disabled and no custom domain is attached.

If a customer requires explicit US-only object-storage residency, the current EEUR bucket must not be represented as meeting that requirement.

### Important 2026 capability

Cloudflare R2 supports jurisdiction-restricted buckets, including a United States jurisdiction.

A bucket's jurisdiction cannot simply be assumed or changed after creation.

If explicit US-only object-storage residency is required for a pilot customer, the production bucket configuration should be evaluated before onboarding that customer.

### Contractual/privacy documentation

Cloudflare publishes a Data Processing Addendum applicable to its services.

The DPA authorizes Cloudflare subprocessors and requires them to receive contractual protections no less protective than Cloudflare's own DPA obligations.

### Downstream subprocessors

Cloudflare maintains a public subprocessor list.

Review it before the first paid pilot and monitor provider changes.

### Labfluss safeguards

- private bucket
- no public attachment access
- organization-scoped storage namespace
- short-lived signed uploads and downloads
- signed upload content length
- content validation
- file-signature validation
- OOXML validation
- staging/final separation
- ETag-conditioned finalization
- attachment authorization
- organization deletion/reconciliation
- customer export integrity checking

### Pilot status

**CONFIGURATION AND PRIVACY DOCUMENTATION VERIFIED**

Before first pilot:

- subscribe to Cloudflare subprocessor-change notifications
- decide whether `http://localhost:5173` should remain allowed on the production bucket

---

## 3. Mailgun / Sinch Email

### Service

Transactional email delivery.

### Labfluss use

Mailgun sends:

- organization invitations
- email-verification messages
- password-reset messages

### Data potentially processed

Mailgun may process:

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

Because one-time URLs contain authentication/recovery tokens, those tokens exist within the message sent to Mailgun even though Labfluss stores only token hashes in PostgreSQL.

This makes transactional-email handling security-sensitive.

### Purpose

Delivery of transactional account and authentication email.

### Provider role

Subprocessor.

### Contractual/privacy documentation

Mailgun is operated as part of Sinch Email.

Mailgun states that it acts as a processor when processing personal data on behalf of customers.

Mailgun's Terms incorporate a Data Processing Agreement for such processing.

Mailgun also uses downstream infrastructure subprocessors.

### Data location

The current Mailgun account and sending domain use the United States region.

The production API configuration must continue to use the Mailgun US API endpoint unless an intentional migration is performed.

Do not assume the region solely from the Labfluss deployment region.

### Retention

The current Mailgun Free account shows:

- dashboard log retention: 1 day
- message-body retention: unavailable on the current plan

Mailgun may retain other operational or statistical records according to its service terms and legal documentation.

The dashboard-visible retention values should be reviewed again if the account is upgraded.

### Labfluss safeguards

- raw token values are not stored in PostgreSQL
- invitation/reset/verification tokens are cryptographically generated
- only hashes are stored in the application database
- links expire
- replacement links invalidate earlier links
- production responses do not expose raw invitation links
- email provider message identifiers are excluded from customer-facing responses and customer exports
- email service failures do not corrupt application transaction state

### Pilot status

**CONFIGURATION VERIFIED, DEDICATED LABFLUSS SENDING DOMAIN PENDING**

Before first pilot:

- create a dedicated Labfluss production sending domain
- verify SPF/DKIM for the Labfluss production sending domain
- update production `MAILGUN_DOMAIN`
- verify production `MAILGUN_API_BASE_URL` remains the US endpoint
- subscribe to Mailgun/Sinch subprocessor-change notifications where available
- decide whether the Free plan is appropriate for paid-pilot transactional email

---

## 4. Better Stack

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

The "Explain with AI and AI summaries" feature should be disabled before the paid pilot to avoid unnecessary AI processing of incident data.

### Labfluss safeguards

- public liveness endpoint contains generic status only
- readiness endpoint exposes availability state without database credentials or customer content
- monitoring does not intentionally receive research records
- sanitized operational logging

### Pilot status

**CONFIGURATION VERIFIED, AI FEATURE AND 2FA HARDENING PENDING**

Before first pilot:

- disable "Allow Explain with AI and AI summaries"
- enable organization-wide 2FA
- review and subscribe to the applicable subprocessor-change notification mechanism

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
- [ ] review current AWS Data Processing Addendum before paid pilot
- [ ] review current AWS subprocessor list before paid pilot
- [ ] subscribe to AWS subprocessor-change notifications
- [ ] confirm customer-specific data-location requirements against the actual AWS services and Regions used

### Cloudflare R2

- [x] production bucket identified: `labflow-attachments`
- [x] bucket location recorded: Eastern Europe (EEUR)
- [x] public development URL confirmed disabled
- [x] no custom domain attached
- [x] R2 Data Catalog confirmed disabled
- [x] CORS policy reviewed
- [x] allowed production origin recorded: `https://app.labfluss.com`
- [x] allowed development origin recorded: `http://localhost:5173`
- [x] allowed methods recorded: GET, PUT, HEAD
- [x] lifecycle rule reviewed: abort incomplete multipart uploads after 7 days
- [x] bucket lock rules confirmed absent
- [x] event notifications confirmed disabled
- [x] on-demand migration confirmed disabled
- [x] local uploads confirmed disabled
- [x] default storage class recorded: Standard
- [x] current Cloudflare DPA reviewed
- [x] current Cloudflare subprocessor list reviewed
- [ ] configure subprocessor-change notifications where available
- [ ] decide whether localhost should remain allowed on the production bucket before pilot

### Mailgun / Sinch Email

- [x] production email provider identified: Mailgun / Sinch Email
- [x] current account region recorded: US
- [x] current plan recorded: Free
- [x] current API region identified: US
- [x] current sending domain recorded: `mg.cockadoodlemeatmarket.com`
- [x] message-retention capability reviewed: unavailable on current plan
- [x] dashboard log retention recorded: 1 day
- [x] click tracking confirmed disabled
- [x] open tracking confirmed disabled
- [x] unsubscribe tracking confirmed disabled
- [x] TLS mode recorded: Opportunistic
- [x] certificate verification confirmed required
- [x] dedicated IP count recorded: 0
- [x] Labfluss-specific sending key confirmed
- [x] current Mailgun/Sinch DPA reviewed
- [x] current Mailgun/Sinch subprocessor list reviewed
- [ ] create a dedicated Labfluss production sending domain
- [ ] verify SPF/DKIM for the Labfluss production sending domain
- [ ] update Labfluss production `MAILGUN_DOMAIN`
- [ ] verify production `MAILGUN_API_BASE_URL` remains the US endpoint
- [ ] configure subprocessor-change notifications where available
- [ ] decide whether the Free plan is appropriate for paid-pilot transactional email

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
- [ ] disable "Allow Explain with AI and AI summaries" before paid pilot
- [ ] enable organization-wide 2FA requirement before paid pilot
- [ ] review subprocessor-change notification mechanism

---

## Review Record

**Last reviewed:** 2026-09-02

**Next review:** Before first paid pilot or upon material provider change, whichever occurs first.

**Status:** Production provider inventory updated after AWS migration. AWS legal/subprocessor review and remaining pre-pilot remediation items remain open.
