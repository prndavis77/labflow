# LabFlow Subprocessor Inventory

**Version:** 1.0
**Applies to:** Initial United States paid pilot program
**Review frequency:** Before the first paid pilot, when a provider changes, and at least annually

## Purpose

This document identifies third-party service providers that may process LabFlow customer data or customer-related operational data in connection with providing the LabFlow service.

For the initial paid pilot, university customers generally determine the purposes of processing their laboratory and user data. LabFlow processes that data to provide the service. Where LabFlow acts as a processor on behalf of the customer, the third-party providers identified in this document may act as LabFlow subprocessors.

The exact legal role of each party depends on the applicable customer agreement and the type of data being processed.

This inventory should be read together with:

- `pilot-data-policy.md`
- `data-inventory.md`
- `retention-policy.md`
- `customer-data-export.md`
- `organization-offboarding.md`
- the applicable LabFlow customer agreement and privacy documentation

## Scope

This inventory covers providers that directly support production LabFlow operations and may receive:

- customer user information
- laboratory workflow data
- research-related application content permitted by the Pilot Data Policy
- attachments
- transactional-email information
- network/request metadata
- application or infrastructure monitoring information

A provider is not included merely because LabFlow developers use that provider for development purposes.

For example, a source-code hosting service that receives no production customer data is not automatically a production customer-data subprocessor.

## Downstream Provider Subprocessors

Some LabFlow providers use their own infrastructure providers and other subprocessors.

Those downstream organizations are not normally direct LabFlow vendors.

LabFlow therefore maintains:

1. this inventory of direct LabFlow service providers; and
2. references to each direct provider's maintained subprocessor list where available.

LabFlow should not copy a provider's entire changing subprocessor list into this document unless there is a specific contractual or operational reason to do so.

Provider-maintained lists should be reviewed periodically and before material production changes.

---

## 1. Render

### Service

Backend/API hosting.

### LabFlow use

Render hosts the production Node.js/Express API and related backend processes.

### Data potentially processed

Because normal application API requests pass through the backend, Render infrastructure may process:

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
- authorization/session-related request information
- request metadata
- sanitized application logs

Attachment binaries normally upload directly between the browser and Cloudflare R2 using signed URLs rather than passing through the backend during normal upload.

The backend may nevertheless process attachment metadata and may access attachment content during specific storage validation, export, deletion, recovery, or administrative operations.

### Purpose

Application hosting and API execution.

### Provider role

Subprocessor where LabFlow processes customer personal data on behalf of a university customer.

### Data location

The production LabFlow backend service is deployed in:

- Frankfurt (EU Central), Germany

The current production compute plan is Free and must be upgraded before the first paid pilot.

### Contractual/privacy documentation

Render publishes a Data Processing Addendum covering customer personal data processed through its services.

Render's DPA authorizes subprocessors and requires written data-protection obligations for those subprocessors.

Render maintains its current subprocessor list through its Trust/Security documentation.

### Downstream subprocessors

Render's current official subprocessor mechanism has been reviewed.

Render requires customers to subscribe to new-subprocessor notifications where they want advance notice of provider changes.

Do not duplicate Render's full changing subprocessor list in this document.

### LabFlow safeguards

- TLS for application traffic
- production environment validation
- sensitive-value log redaction
- no raw authentication/reset/verification tokens in logs
- organization authorization and tenant isolation
- database TLS
- private Cloudflare R2 storage

### Pilot status

**CONFIGURATION VERIFIED, PRODUCTION PLAN UPGRADE PENDING**

Before first pilot:

- upgrade the production service from Free to a paid instance
- subscribe to Render subprocessor-change notifications
- record the final paid production instance type

---

## 2. Vercel

### Service

Frontend hosting and content delivery.

### LabFlow use

Vercel hosts the compiled React/Vite frontend.

The browser communicates directly with the LabFlow backend API rather than storing ordinary application customer records in Vercel.

### Data potentially processed

Vercel may process operational web-request information such as:

- IP address
- user agent
- request URL
- timestamps
- network/security telemetry

LabFlow does not intentionally store the PostgreSQL customer dataset or Cloudflare R2 attachment binaries in Vercel.

Application architecture must continue to avoid embedding production secrets or customer data into frontend build artifacts.

### Purpose

Frontend hosting, static asset delivery, and related network/security operations.

### Provider role

Subprocessor or operational processor depending on the data and applicable customer relationship.

### Data location

Vercel states that its primary processing facilities are in the United States and that processing may also occur where Vercel or its subprocessors maintain operations.

### Contractual/privacy documentation

Vercel publishes a Data Processing Addendum.

The current DPA states that it applies to Enterprise and Pro plans.

### Pilot plan requirement

**VERIFY BEFORE PILOT.**

The production LabFlow frontend should use a Vercel plan covered by the applicable DPA.

If the deployment remains on a plan not covered by the DPA, this must be resolved before accepting paid-pilot customer data.

### Downstream subprocessors

Vercel maintains its current subprocessor list through its security/trust site.

Review the current list before the pilot and subscribe to updates where available.

### LabFlow safeguards

- no backend credentials in frontend source
- no database credentials in browser code
- direct authenticated API calls to the backend
- HTTPS
- CORS restrictions
- short-lived R2 signed URLs

### Pilot status

**NOT PILOT-READY: HOBBY PLAN / DPA-COVERED PLAN UPGRADE PENDING**

Required before first pilot:

- verify current Vercel plan
- ensure the plan is covered by the DPA
- review current provider subprocessor list

---

## 3. Neon

### Service

Managed PostgreSQL database hosting.

### LabFlow use

Neon stores the production PostgreSQL database.

### Data potentially processed

Neon stores the primary structured LabFlow customer dataset, including:

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

Raw attachment binaries are stored in Cloudflare R2 rather than PostgreSQL.

### Purpose

Persistent relational database storage and database recovery capability.

### Provider role

Subprocessor.

### Data location

The production Neon project is deployed in:

- AWS Europe Central 1 (Frankfurt)

The production project currently runs on the Free plan.

The Free-plan compute allowance has been exhausted and the production database must be moved to suitable paid capacity before the first paid pilot.

### Contractual/privacy documentation

Neon is now part of the Databricks platform.

The current Neon Product Specific Schedule is governed by the Databricks Master Cloud Services Agreement and applicable Databricks Data Processing Addendum.

For Neon Platform Services, the current legal schedule specifies that:

- Databricks acts as the contracting provider
- the Databricks subprocessor list applies
- Grafana Labs, located in the United States, is additionally used for Neon infrastructure services

### Downstream subprocessors

The current Databricks subprocessor list includes cloud infrastructure, support, communications, and related service providers.

The list must be reviewed before material production changes and provider update notifications should be subscribed to where available.

### LabFlow safeguards

- PostgreSQL TLS
- certificate verification enabled by default
- production rejection of unsafe URL-based SSL overrides
- tenant-scoped application queries
- password hashing
- token hashing
- organization deletion procedures
- customer export procedures
- backup/recovery procedures

### Retention considerations

Database production deletion follows LabFlow's organization-offboarding process.

Historical copies may remain temporarily within backups or point-in-time recovery systems according to the applicable provider capabilities and LabFlow retention policy.

### Pilot status

**NOT PILOT-READY: FREE COMPUTE LIMIT EXHAUSTED**

Before first pilot:

- upgrade from Free to suitable paid production capacity
- record the final paid plan
- choose the final history/PITR retention window
- configure automated backup/snapshot strategy
- review whether IP allow-listing or private networking is required
- subscribe to provider subprocessor-change notifications where available

---

## 4. Cloudflare

### Service

Cloudflare R2 object storage.

### LabFlow use

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

### LabFlow safeguards

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

**CONFIGURATION AND PRIVACY DOCUMENTATION VERIFIED, PRE-PILOT CORS CLEANUP PENDING**

Before first pilot:

- subscribe to Cloudflare subprocessor-change notifications
- update the production CORS origin when the custom LabFlow domain is introduced
- decide whether `http://localhost:5173` should remain allowed on the production bucket

---

## 5. Mailgun / Sinch Email

### Service

Transactional email delivery.

### LabFlow use

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

Because one-time URLs contain authentication/recovery tokens, those tokens exist within the message sent to Mailgun even though LabFlow stores only token hashes in PostgreSQL.

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

Do not assume the region solely from the LabFlow deployment region.

### Retention

The current Mailgun Free account shows:

- dashboard log retention: 1 day
- message-body retention: unavailable on the current plan

Mailgun may retain other operational or statistical records according to its service terms and legal documentation.

The dashboard-visible retention values should be reviewed again if the account is upgraded.

### LabFlow safeguards

- raw token values are not stored in PostgreSQL
- invitation/reset/verification tokens are cryptographically generated
- only hashes are stored in the application database
- links expire
- replacement links invalidate earlier links
- production responses do not expose raw invitation links
- email provider message identifiers are excluded from customer-facing responses and customer exports
- email service failures do not corrupt application transaction state

### Pilot status

**CONFIGURATION VERIFIED, DEDICATED LABFLOW SENDING DOMAIN PENDING**

Before first pilot:

- create a dedicated LabFlow production sending domain
- verify SPF/DKIM for the LabFlow production sending domain
- update production `MAILGUN_DOMAIN`
- verify production `MAILGUN_API_BASE_URL` remains the US endpoint
- subscribe to Mailgun/Sinch subprocessor-change notifications where available
- decide whether the Free plan is appropriate for paid-pilot transactional email

---

## 6. Better Stack

### Service

External uptime/readiness monitoring and operational alerting.

### LabFlow use

Better Stack monitors production availability, including LabFlow health/readiness endpoints.

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

The monitored LabFlow health endpoints must remain free of customer records, credentials, secrets, database connection information, and other sensitive content.

### Purpose

Availability monitoring and operational alerting.

### Provider role

Operational subprocessor/service provider.

### Data location

The current Better Stack configuration uses its EU/Germany data-region posture for control-plane and incident log-snippet handling.

LabFlow currently uses Better Stack only for external uptime monitoring and does not intentionally ingest application logs, research data, or frontend session telemetry.

### Contractual/privacy documentation

Better Stack publishes a Data Processing Addendum covering Customer Personal Data processed through its services.

The current Better Stack DPA and authorized subprocessor schedule have been reviewed.

The current authorized subprocessor schedule includes infrastructure, support, communications, analytics, and AI service providers.

Because LabFlow currently uses Better Stack only for uptime monitoring, the operational data exposed to Better Stack is intentionally limited.

The "Explain with AI and AI summaries" feature should be disabled before the paid pilot to avoid unnecessary AI processing of incident data.

### LabFlow safeguards

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

GitHub hosts LabFlow source code.

Production customer records and production secrets must not be committed to the repository.

Provided that this boundary is maintained, GitHub is not currently classified as a processor of LabFlow pilot customer content for the purposes of this inventory.

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

Where providers offer subprocessor-change notifications, LabFlow should subscribe to them.

At minimum, the operator should review this inventory:

- before the first paid pilot
- before onboarding a customer with specific data-location requirements
- when changing production providers
- after receiving a provider subprocessor-change notice
- during annual privacy/security review

---

## Customer Disclosure

The initial paid-pilot agreement or privacy documentation should identify the applicable LabFlow subprocessors or provide a maintained reference to this inventory.

A customer should be able to understand:

- who processes its data
- why the provider is used
- what broad category of data may be processed
- relevant location information
- how material provider changes will be handled

LabFlow should not promise a specific provider, region, or downstream subprocessor arrangement unless that configuration has been verified and can be maintained contractually.

---

## Pre-Pilot Verification Checklist

The following items remain configuration-specific and must be verified before the first paid pilot:

### Render

- [x] production service identified: `labflow-backend`
- [x] production service region recorded: Frankfurt (EU Central)
- [x] current compute plan recorded: Free
- [x] production database configuration confirmed
- [x] production R2 configuration confirmed
- [x] production health check confirmed: `/api/health`
- [x] Render DPA reviewed
- [x] current Render subprocessor mechanism reviewed
- [ ] upgrade production service from Free before paid pilot
- [ ] subscribe to Render subprocessor-change notifications
- [ ] record final paid production instance type after upgrade

### Vercel

- [x] production project identified: `labflow`
- [x] current plan recorded: Hobby
- [x] production domain recorded: `labflow-brown.vercel.app`
- [x] Web Analytics confirmed disabled
- [x] current model-training data preference reviewed
- [x] "Improve models with this project's data" disabled
- [x] current Vercel subprocessor list and Trust Center reviewed
- [ ] upgrade production account/project to Pro or Enterprise before paid pilot
- [ ] verify DPA coverage after upgrade
- [ ] subscribe to Vercel subprocessor-change notifications
- [ ] add and verify custom production domain before pilot

### Neon

- [x] production project identified: `labflow`
- [x] production branch identified: `production`
- [x] current plan recorded: Free
- [x] production region recorded: AWS Europe Central 1 (Frankfurt)
- [x] PostgreSQL version recorded: 17
- [x] compute configuration recorded: 0.25 to 2 CU
- [x] scale-to-zero recorded: 5 minutes
- [x] production storage usage reviewed
- [x] production network-transfer usage reviewed
- [x] current restore/history window recorded: 6 hours
- [x] manual snapshot capability verified
- [x] current snapshot exists
- [x] public internet database access confirmed enabled
- [x] HIPAA support confirmed disabled
- [x] logical replication confirmed disabled
- [x] current Neon/Databricks Product Specific Schedule reviewed
- [x] current Databricks subprocessor mechanism reviewed
- [x] Neon-specific Grafana Labs infrastructure subprocessor identified
- [ ] upgrade from Free before paid pilot
- [ ] select final paid plan and record it
- [ ] configure production capacity suitable for pilot use
- [ ] choose final history/PITR retention on paid plan
- [ ] configure automated backup/snapshot strategy
- [ ] review whether IP allow-listing or private networking is required
- [ ] subscribe to subprocessor-change notifications where available

### Cloudflare R2

- [x] production bucket identified: `labflow-attachments`
- [x] bucket location recorded: Eastern Europe (EEUR)
- [x] public development URL confirmed disabled
- [x] no custom domain attached
- [x] R2 Data Catalog confirmed disabled
- [x] CORS policy reviewed
- [x] allowed production origin recorded: `https://labflow-brown.vercel.app`
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
- [ ] update production CORS origin when the custom LabFlow domain is introduced
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
- [x] LabFlow-specific sending key confirmed
- [x] current Mailgun/Sinch DPA reviewed
- [x] current Mailgun/Sinch subprocessor list reviewed
- [ ] create a dedicated LabFlow production sending domain
- [ ] verify SPF/DKIM for the LabFlow production sending domain
- [ ] update LabFlow production `MAILGUN_DOMAIN`
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

**Last reviewed:** 2026-08-26

**Next review:** Before first paid pilot or upon material provider change, whichever occurs first.

**Status:** Configuration and provider legal review completed. Pre-pilot remediation items remain open.
