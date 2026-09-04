# Labfluss Security Safeguards

**Version:** 1.0
**Applies to:** Initial United States paid pilot program
**Last reviewed:** 2026-09-04

## 1. Purpose

This document describes the technical and organizational safeguards currently used to protect Labfluss and customer information during the initial paid pilot.

Labfluss is a project-management and laboratory-workflow platform intended for university research laboratories.

This document is intended to provide customers and institutional reviewers with a practical overview of Labfluss's current security controls.

It is not:

- a security certification;
- a SOC 2 report;
- an ISO 27001 certification;
- a penetration-test report;
- a HIPAA compliance attestation;
- a FERPA certification;
- an ITAR compliance statement; or
- a guarantee that security incidents cannot occur.

This document should be read together with:

- `privacy-policy.md`
- `pilot-data-policy.md`
- `data-inventory.md`
- `retention-policy.md`
- `subprocessor-inventory.md`
- `backup-recovery.md`
- `organization-offboarding.md`
- `customer-data-export.md`
- `hipaa-scope-statement.md`
- `ferpa-scope-statement.md`
- `export-control-restriction.md`
- applicable customer agreements

## 2. Security Objectives

Labfluss's security controls are designed to support:

- confidentiality of customer information;
- integrity of application data;
- availability of the service;
- isolation between customer organizations;
- authenticated and authorized access;
- protection of credentials and security tokens;
- secure handling of uploaded attachments;
- detection and investigation of security-relevant activity;
- recoverability following operational failure;
- controlled organization offboarding and deletion; and
- minimization of unnecessary sensitive-data exposure.

## 3. Security Responsibility Model

Labfluss operates as a cloud-hosted software service using third-party infrastructure providers.

Security responsibility is shared among:

- Labfluss;
- its infrastructure and service providers;
- organizational customers; and
- authorized users.

Labfluss is responsible for safeguards within the application and configurations under its control.

Infrastructure providers are responsible for safeguards applicable to their underlying hosted services according to their respective service agreements.

Customers are responsible for:

- determining whether Labfluss is approved for their intended information;
- authorizing appropriate users;
- assigning appropriate roles;
- protecting their account credentials;
- complying with institutional security and privacy requirements;
- preventing prohibited data from being entered into Labfluss; and
- promptly reporting suspected unauthorized access or security incidents.

## 4. Application Authentication

Labfluss requires authenticated access for protected application functionality.

Current authentication safeguards include:

- password-based authentication;
- password hashing rather than plaintext password storage;
- email verification;
- password-reset mechanisms;
- invitation-based organization onboarding;
- hashed verification, invitation, and password-reset tokens in the application database;
- expiration of applicable one-time security tokens; and
- validation of authentication state before protected operations.

Raw one-time token values are not intentionally persisted in the application database.

Temporary token values may be transmitted through transactional email where required for account activation, invitation, verification, or password reset.

## 5. Password Protection

Labfluss does not store plaintext user passwords.

Passwords are stored using cryptographic password hashing.

Application code and operational logging are designed to avoid intentionally exposing plaintext passwords.

Users remain responsible for:

- selecting appropriate passwords;
- protecting their credentials;
- avoiding credential sharing; and
- reporting suspected account compromise.

Labfluss does not currently claim to provide enterprise identity federation, institutional single sign-on, or mandatory multi-factor authentication for all pilot users unless such functionality is separately implemented and verified.

## 6. Authorization and Role-Based Access Control

Labfluss uses role-based authorization.

Current application roles include:

- Admin;
- Supervisor; and
- Researcher.

Authorization checks are applied to protected operations based on the user's authenticated identity, organization membership, role, and applicable resource relationship.

Role assignment does not replace customer responsibility for determining which users should have access to specific research or administrative information.

## 7. Organization and Tenant Isolation

Labfluss is designed as a multi-tenant application.

Customer organizations are logically separated through organization-scoped access controls.

Application operations are designed to verify that users may access only resources belonging to organizations for which they are authorized.

Organization-scoped controls apply to areas including:

- projects;
- project memberships;
- tasks;
- experiments;
- protocols;
- equipment;
- bookings;
- notebook records;
- reviews;
- attachments; and
- other organization-owned resources.

Security regression testing includes organization-isolation and authorization behavior.

No multi-tenant system can guarantee that implementation defects will never occur. Labfluss treats tenant-isolation failures as security defects requiring remediation.

## 8. Database Security

Labfluss uses PostgreSQL for relational application data.

Database safeguards include:

- authenticated database access;
- encrypted database transport for hosted production connections;
- private-only production Amazon RDS database access;
- private Lightsail-to-RDS connectivity;
- encrypted RDS storage;
- Amazon RDS automated backups with a 7-day retention window;
- production configuration validation;
- restricted database connection information;
- environment-based credential management;
- separation between production and test database configuration; and
- safeguards intended to prevent test tooling from accidentally targeting an unapproved database.

Production schema changes are performed through migrations rather than automatic production schema synchronization.

Development setup utilities are designed not to act as production schema-management mechanisms.

## 9. Database TLS

Hosted production database connections use TLS.

Labfluss production database connections use certificate validation with the applicable Amazon RDS certificate-authority bundle.

Production configuration rejects certain insecure or ambiguous database SSL connection patterns.

Labfluss does not represent that database TLS alone provides complete protection of customer data.

## 10. Attachment Storage

Attachments are stored separately from the primary relational database using private object storage.

Current attachment safeguards include:

- organization-scoped storage namespaces;
- private object storage;
- authorization before attachment operations;
- short-lived signed upload and download URLs;
- filename validation;
- extension validation;
- MIME-type validation;
- maximum file-size enforcement;
- signed upload content-length constraints;
- post-upload content inspection;
- file-signature or magic-byte inspection where applicable;
- additional validation for supported Office Open XML files;
- temporary staging before finalization;
- finalization verification; and
- cleanup procedures for rejected or abandoned uploads.

Application responses are designed not to expose internal attachment storage keys unnecessarily.

## 11. Attachment Finalization

Uploaded files are not treated as permanent application attachments solely because an upload request succeeded.

The attachment workflow includes validation and finalization steps intended to verify that the uploaded object matches expected characteristics before permanent association with an application record.

Where supported by the object-storage workflow, finalization includes integrity-related checks such as:

- object metadata validation;
- object size verification;
- ETag-related checks;
- conditional copy behavior; and
- verification of the finalized object.

Rejected uploads are subject to cleanup.

Temporary staging objects are subject to scheduled cleanup procedures.

## 12. Attachment Download Protection

Attachment downloads require authorization.

Labfluss uses short-lived signed object-storage URLs rather than exposing permanent public attachment URLs.

The object-storage bucket used for production attachments is not intentionally configured as a public file repository.

Signed URLs should be treated as sensitive while valid and should not be shared with unauthorized parties.

## 13. File-Type Restrictions

Labfluss does not permit arbitrary unrestricted file upload.

Supported attachment types are subject to application validation.

File validation is intended to reduce risks from:

- misleading filenames;
- incorrect extensions;
- mismatched MIME types;
- malformed supported document containers; and
- obviously invalid file signatures.

File validation reduces risk but does not guarantee that every malicious or unsafe file can be detected.

Customers should continue to use endpoint protection and institutional security controls when opening downloaded files.

## 14. Network Transport Security

Labfluss production services are accessed using HTTPS.

TLS is used for network communications between users and externally exposed production application services.

Hosted production database communication uses encrypted transport.

Object-storage communication uses TLS-supported provider endpoints.

Labfluss does not intentionally transmit customer application content over plaintext public HTTP in the production configuration.

## 15. Application Security Headers

Labfluss uses application-level HTTP security controls intended to reduce common web risks.

These include security headers applied through the backend security middleware.

The exact set of headers may change as the application and deployment architecture evolve.

Security headers are one layer of defense and do not replace secure application design, authorization, input validation, or patching.

## 16. Cross-Origin Access

Production cross-origin access is restricted to explicitly configured allowed frontend origins.

Production configuration validation is intended to prevent broad or unintended CORS configurations from being silently deployed.

Development origins may be permitted in development-specific or explicitly configured contexts.

Production-origin configuration should be reviewed whenever the production frontend domain changes.

## 17. Proxy and Client Address Handling

Labfluss validates its reverse-proxy configuration.

Production deployments use an explicitly controlled trusted-proxy configuration rather than automatically trusting arbitrary proxy chains.

Proxy configuration affects security-sensitive behavior such as:

- client IP interpretation;
- rate-related controls;
- secure request handling; and
- operational logging.

Changes to hosting topology should trigger review of the trusted-proxy configuration.

## 18. Input and Request Validation

Application endpoints validate request data according to the requirements of the applicable operation.

Security-sensitive input validation includes controls associated with:

- authentication;
- organization identifiers;
- user roles;
- file uploads;
- resource ownership;
- storage prefixes; and
- production configuration.

Input validation reduces risk but does not replace authorization checks.

## 19. Error Handling

Labfluss uses centralized error handling.

Production error responses are intended to avoid unnecessarily exposing:

- credentials;
- secret tokens;
- internal storage keys;
- sensitive configuration;
- database connection information;
- internal exception details; and
- other security-sensitive implementation information.

Unknown-route handling avoids reflecting unnecessary raw request information.

Internal logs may contain more diagnostic information than user-facing responses but are subject to redaction controls.

## 20. Logging and Sensitive-Data Redaction

Labfluss uses centralized structured application logging.

Security-related logging safeguards include:

- request identifiers;
- structured log output;
- credential redaction;
- security-token redaction;
- avoidance of intentional plaintext password logging;
- avoidance of intentional raw reset, verification, or invitation token persistence in logs; and
- sanitized application error logging.

Logging is intended to provide operational and security visibility while limiting unnecessary sensitive-data exposure.

No logging system can guarantee that application defects will never cause unintended information to be recorded.

## 21. Audit Logging

Labfluss maintains application audit information for certain security and workflow actions.

Audit data may include:

- user identifiers;
- organization identifiers;
- action type;
- affected resource;
- timestamps; and
- related operational metadata.

Audit records support:

- accountability;
- troubleshooting;
- security investigation;
- administrative review; and
- workflow history.

The current audit system should not be represented as a certified regulatory audit trail for systems subject to specialized requirements such as 21 CFR Part 11.

## 22. Production Configuration Validation

Labfluss validates security-sensitive configuration at application startup.

Production validation includes controls relating to:

- environment selection;
- database configuration;
- JWT secrets;
- frontend origin configuration;
- TLS-related database configuration; and
- other deployment-sensitive settings.

The application is designed to fail or report configuration problems rather than silently accepting certain unsafe production configurations.

## 23. JWT Security

Labfluss uses JSON Web Tokens as part of its authentication mechanism.

Production configuration requires an appropriately sized JWT secret.

JWT secrets are supplied through deployment environment configuration and are not intended to be committed to the source repository.

Authentication tokens should be treated as sensitive credentials.

## 24. Secrets Management

Production backend secrets are supplied through restricted environment configuration on the AWS Lightsail host.

The production backend environment file is restricted at the operating-system level and is not committed to source control.

Sensitive values include items such as:

- database credentials;
- JWT secrets;
- object-storage credentials;
- transactional email credentials; and
- other provider API credentials.

The repository is configured to exclude local `.env` files from source control.

Secrets must not be committed to Git or intentionally stored in customer-visible documentation.

Where a credential is suspected of exposure, it should be rotated.

## 25. Production Schema Management

Production database schema changes use versioned database migrations.

Automatic production schema synchronization is not used as the normal production schema-management mechanism.

Development setup scripts contain safeguards intended to prevent accidental production execution.

Production seed operations require explicit authorization rather than running automatically.

## 26. Availability Monitoring

Labfluss uses Better Stack for external availability monitoring.

Current monitoring includes checks for:

- frontend availability;
- API liveness; and
- application readiness.

The API exposes separate health concepts:

- liveness, indicating that the application process is running; and
- readiness, indicating whether required dependencies such as the database are available.

A database outage may therefore cause readiness to fail while the API process remains alive.

This separation improves operational visibility and reduces the risk of treating dependency failure as application-process failure.

## 27. Dependency and Service Failure Handling

Labfluss is designed so that failure of a critical dependency does not necessarily prevent the application process from starting.

When the database is unavailable:

- the application can remain live;
- readiness can report failure; and
- dependency-related operations may remain unavailable until connectivity is restored.

This behavior supports clearer monitoring and operational response.

## 28. Backup and Recovery

Labfluss maintains documented backup and recovery procedures.

Current recovery measures include:

- Amazon RDS automated backups with a 7-day retention window;
- Amazon RDS point-in-time recovery within the retained backup window;
- a post-cutover manual Amazon RDS DB snapshot;
- portable PostgreSQL logical backups;
- attachment backup procedures;
- recovery validation;
- isolated database restore testing;
- object-storage recovery testing; and
- application validation against recovered database state.

Recovery documentation defines target objectives for:

- Recovery Point Objective; and
- Recovery Time Objective.

Current recovery capability and provider limits are documented separately and should not be represented as stronger than the verified configuration.

## 29. Recovery Limitations

The initial pilot recovery architecture has operational limitations.

Current limitations include:

- automated recurring attachment backups are not yet implemented;
- the independent attachment backup is currently stored locally;
- no off-machine or off-provider attachment backup copy is currently configured;
- full infrastructure reconstruction has not been drill-tested;
- a production disaster-recovery cutover has not been drill-tested; and
- some recovery procedures still depend on provider control planes and documented manual operations.

These limitations are tracked as pre-pilot or operational-improvement items.

## 30. Customer Data Export

Labfluss maintains a documented customer-data export workflow.

Organization exports are designed to include permitted organization-owned data and attachments while excluding security-sensitive internal information.

The export process uses explicit field allowlists rather than indiscriminately serializing complete internal database models.

Security-sensitive fields such as authentication tokens and internal storage implementation details are excluded from normal customer exports.

## 31. Organization Offboarding and Deletion

Labfluss maintains documented organization offboarding and deletion procedures.

Offboarding includes controls intended to:

- stop organization access;
- prevent continued authentication where applicable;
- export customer information when requested;
- delete organization-owned database information;
- delete organization-owned attachment objects; and
- verify completion.

Organization deletion is treated as an operator-controlled administrative process during the initial pilot.

## 32. Access Freeze

Labfluss supports organization access-freeze behavior as part of offboarding.

Freezing an organization is intended to prevent continued user access while administrative export or deletion procedures are performed.

Access freezing does not substitute for final deletion.

## 33. Data Minimization

Labfluss attempts to collect and retain only information reasonably required for the service.

The Pilot Data Policy further restricts categories of information that users may enter.

The initial paid pilot prohibits or restricts categories including:

- PHI/ePHI requiring HIPAA-regulated handling;
- official FERPA-protected education records requiring specialized handling;
- ITAR-controlled technical data;
- restricted export-controlled information;
- classified information;
- certain Controlled Unclassified Information;
- third-party credentials;
- API secrets;
- payment-card information stored as Customer Content; and
- other highly sensitive or regulated information outside the supported service scope.

## 34. Data Retention

Labfluss maintains a documented retention policy.

Retention depends on:

- organization status;
- customer instructions;
- account requirements;
- security requirements;
- legal obligations;
- backup and recovery behavior; and
- provider retention characteristics.

Deleted information may remain temporarily in backups or provider recovery systems until the relevant retention period expires or the information is overwritten.

## 35. Data Locations and Subprocessors

Labfluss uses third-party service providers for functions including:

- frontend hosting;
- backend hosting;
- database hosting;
- object storage;
- transactional email; and
- uptime monitoring.

Provider information and known production-region configuration are maintained in the Labfluss Subprocessor Inventory.

Labfluss does not currently represent that all customer data remains exclusively within the United States.

Customers with specific residency requirements must raise those requirements before transmitting customer data.

## 36. Service Provider Review

Labfluss reviews material production providers with attention to:

- service purpose;
- production region;
- data handled;
- security capabilities;
- contractual mechanisms;
- data-processing terms;
- subprocessors;
- retention behavior; and
- relevant configuration.

Provider review does not constitute an independent audit of the provider.

Customers should refer to provider documentation and contractual materials where independent certification details are required.

## 37. Security Monitoring

Labfluss currently uses external uptime and readiness monitoring.

The monitoring configuration is intentionally limited and does not rely on broad browser-session replay or customer-content analytics as part of the initial pilot configuration.

Additional monitoring may be introduced later following privacy and security review.

## 38. Security Testing

Labfluss maintains automated security-related regression tests.

Testing includes areas such as:

- authentication behavior;
- authorization;
- tenant isolation;
- security middleware;
- production configuration validation;
- health and readiness behavior;
- attachment security;
- token handling; and
- organization access controls.

Automated testing reduces regression risk but does not replace:

- manual review;
- dependency monitoring;
- vulnerability assessment;
- penetration testing; or
- secure development practices.

## 39. Dependency Management

Labfluss uses third-party software dependencies.

Dependencies are reviewed using package-management security tooling.

Known dependency findings are evaluated based on:

- severity;
- exploitability;
- affected code path;
- upgrade availability;
- compatibility impact; and
- risk of introducing a more serious regression through forced upgrades.

Labfluss does not automatically apply breaking dependency downgrades or forced fixes solely to eliminate an audit warning.

Accepted dependency risk should be documented and revisited periodically.

## 40. Secure Development Practices

Security-related development practices include:

- source control;
- code review through Git history and staged-diff review;
- automated tests;
- production configuration safeguards;
- migrations for production schema changes;
- avoidance of committing secrets;
- explicit security regression coverage; and
- runtime verification after security-sensitive changes.

Security-sensitive changes should be tested before deployment.

## 41. Source Control

Labfluss source code is maintained using Git.

Production secrets must not be committed to source control.

Source control supports:

- change history;
- rollback analysis;
- change review;
- deployment reproducibility; and
- recovery of application source code.

Source-code availability alone does not provide full infrastructure disaster recovery.

## 42. Incident Response

Suspected security incidents should be reported to the designated Labfluss security contact.

Incident response may include:

- initial assessment;
- containment;
- access restriction;
- credential rotation;
- preservation of relevant evidence;
- investigation;
- customer coordination;
- remediation;
- recovery;
- notification where required; and
- post-incident review.

Specific legal or contractual notification requirements depend on the circumstances.

## 43. Prohibited Data Incident Handling

If prohibited sensitive information is accidentally entered into Labfluss, handling should follow the applicable scope document.

Examples include:

- PHI/ePHI under the HIPAA Scope Statement;
- FERPA-protected education records under the FERPA Scope Statement; and
- export-controlled information under the Export-Control Restriction.

Users should avoid unnecessarily copying or redistributing prohibited information while an incident is being evaluated.

## 44. Security Contact

Security incidents and security-related questions should be directed to:

**[SECURITY EMAIL ADDRESS]**

This address must be completed before the security documentation is published to pilot customers.

## 45. Privacy Contact

Privacy-related questions should be directed to:

**[PRIVACY EMAIL ADDRESS]**

This address must be completed before the security documentation is published to pilot customers.

## 46. Organizational Measures

Current organizational safeguards include:

- documented pilot data restrictions;
- documented retention procedures;
- documented customer export procedures;
- documented organization offboarding procedures;
- documented backup and recovery procedures;
- documented subprocessor inventory;
- security-sensitive deployment review;
- controlled production configuration;
- incident-response expectations;
- provider configuration review; and
- explicit scope restrictions for regulated data.

The initial pilot is operated with a small administrative footprint.

As the service grows, additional formal organizational controls may be required.

## 47. Administrative Access

Administrative access to production systems should be limited to persons with a legitimate operational need.

Administrative credentials must be protected and must not be shared unnecessarily.

Administrative access should be removed when no longer required.

The initial pilot does not claim mature enterprise privileged-access-management capabilities unless those controls are separately implemented and verified.

## 48. Personnel Security

The initial pilot does not currently represent that Labfluss maintains:

- a large dedicated security team;
- formal 24-hour security operations;
- enterprise background-check programs;
- formal privileged-access-management tooling;
- dedicated compliance personnel; or
- formalized enterprise security training programs beyond controls actually implemented.

These areas should be expanded as personnel and customer requirements grow.

## 49. Physical Security

Labfluss does not operate its own production data centers.

Physical infrastructure security is primarily provided by the cloud infrastructure providers used for production services.

Labfluss does not independently represent or certify provider physical-security controls beyond information made available by those providers.

## 50. Business Continuity

Labfluss maintains recovery procedures intended to support service restoration following operational failure.

Current continuity planning includes:

- source-code recovery;
- database restoration;
- attachment recovery;
- application deployment reconstruction;
- provider configuration documentation; and
- operational monitoring.

A complete automated infrastructure reconstruction and disaster-recovery production cutover exercise has not yet been completed for the initial pilot.

## 51. Security Limitations and Open Items

The following areas are recognized as requiring continued improvement before or during broader production use:

- automated recurring object-storage backups;
- independent off-provider or off-machine attachment backup;
- full infrastructure reconstruction testing;
- disaster-recovery production cutover testing;
- dedicated Labfluss transactional-email domain;
- dedicated production transactional-email configuration, including either hardened Mailgun production use or migration to Amazon SES;
- review of whether the localhost development origin should remain allowed on the production S3 bucket;
- production-provider account hardening;
- enforcement of appropriate multi-factor authentication on provider administrative accounts;
- disabling unnecessary provider AI or telemetry features where applicable;
- formal vulnerability scanning;
- independent penetration testing;
- broader security incident-response exercises;
- automated frontend/E2E testing; and
- expanded centralized log aggregation and retention where justified.

Open items must not be represented as completed controls.

## 52. Regulated Data Limitations

The initial Labfluss pilot is intentionally restricted.

Labfluss is not currently represented as:

- HIPAA compliant;
- a HIPAA business associate service;
- FERPA certified;
- an official FERPA student-record system;
- ITAR compliant;
- approved for ITAR-controlled technical data;
- compliant with a customer's Technology Control Plan;
- a 21 CFR Part 11 compliant system of record;
- a validated GxP system;
- a classified-information system; or
- an approved CUI environment.

Applicable scope documents define these limitations in more detail.

## 53. Customer Security Review

Labfluss may provide customers with available security documentation to support institutional review.

Customers may request clarification regarding:

- architecture;
- hosting;
- authentication;
- access control;
- tenant isolation;
- encryption;
- attachment handling;
- backups;
- monitoring;
- subprocessors;
- retention;
- deletion;
- incident response; and
- known service limitations.

Labfluss should answer such requests based on verified current controls and should not claim controls that have not been implemented or tested.

## 54. Change Management

Security-sensitive changes should be:

- implemented through source-controlled changes where applicable;
- reviewed before production deployment;
- tested;
- validated after deployment where appropriate; and
- reflected in security documentation when materially relevant.

Material infrastructure, authentication, authorization, storage, logging, or provider changes should trigger review of this document.

## 55. Review Schedule

This document should be reviewed:

- before the first paid pilot;
- after material architecture changes;
- after material security incidents;
- after material provider changes;
- when regulated-data scope changes;
- before making new security claims to customers; and
- at least annually.

## 56. Current Security Status

**Tenant isolation:** Implemented.

**Role-based authorization:** Implemented.

**Password hashing:** Implemented.

**Token hashing:** Implemented.

**TLS for production application traffic:** Implemented.

**Hosted database transport encryption:** Implemented.

**Private-only production database:** Implemented.

**Private Lightsail-to-RDS connectivity:** Implemented.

**Private attachment storage:** Implemented.

**Short-lived signed attachment URLs:** Implemented.

**Attachment content validation:** Implemented.

**Structured logging and sensitive-data redaction:** Implemented.

**Audit logging:** Implemented.

**Production configuration validation:** Implemented.

**Database backup and recovery procedures:** Implemented, including 7-day Amazon RDS automated backups, point-in-time recovery capability, a manual post-cutover snapshot, and tested portable PostgreSQL restore procedures.

**Attachment backup and recovery procedures:** Implemented, with further automation required.

**External availability monitoring:** Implemented.

**Production custom HTTPS domains:** Implemented.

**Automated security regression tests:** Implemented.

**Organization offboarding/deletion procedure:** Implemented.

**Customer-data export procedure:** Implemented.

**HIPAA-regulated PHI/ePHI supported:** No.

**Official FERPA education-record system:** No.

**ITAR-controlled technical data supported:** No.

**Independent penetration test completed:** No.

**SOC 2 certification:** No.

**ISO 27001 certification:** No.

**Formal enterprise security program:** Not yet.

**Review status:** Approved as the documented security baseline for the initial restricted paid-pilot scope.
