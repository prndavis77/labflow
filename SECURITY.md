# Labfluss Security

## Security model

Labfluss is a multi-tenant laboratory project-management application.

Backend security controls are designed around:

- authenticated API access
- role-based authorization
- organization-level tenant isolation
- explicit request validation
- restricted field assignment
- protected file storage
- safe error handling and logging
- production configuration validation
- dependency and supply-chain review

## Authentication

Labfluss uses JWT bearer authentication.

JWTs:

- are signed using `JWT_SECRET`
- include issuer `labflow-api`
- include audience `labflow-web`
- expire according to the application token policy
- include `tokenVersion` so server-side account or password changes can invalidate older sessions

Production requires a `JWT_SECRET` of at least 32 characters.

Password hashes are never included in API responses.

## Account security

Labfluss includes:

- password policy enforcement
- password-reset tokens
- email-verification tokens
- token hashing before persistence
- expiration of reset and verification tokens
- session invalidation after security-sensitive account changes
- rate limits on authentication-sensitive endpoints

Raw reset, verification, and invitation tokens must not be persisted or logged.

## Authorization and tenant isolation

Users belong to an organization.

API access is scoped by:

- authenticated user identity
- role
- organization
- resource-specific access rules

Cross-organization records must not be returned merely because a caller knows a database identifier.

Where appropriate, inaccessible cross-tenant resources are returned as not found rather than exposing their existence.

## Request validation

Request bodies and route/query parameters are validated before persistence.

Controllers use explicit field allowlists for mutable properties to reduce mass-assignment risk.

Database access uses Sequelize query APIs rather than constructing SQL from untrusted user input.

## Attachments

Attachments use private object storage.

Security controls include:

- filename and extension validation
- MIME validation
- maximum file-size enforcement
- content inspection using file signatures
- OOXML structural validation for supported Office documents
- short-lived presigned upload URLs
- signed upload content length
- staging object keys
- ETag-conditioned finalization
- final-object verification
- cleanup of rejected and expired uploads
- short-lived signed download URLs
- organization and resource authorization before file access

Internal storage keys, checksums, and ETags are not exposed through normal API responses.

## Logging and error handling

Production API errors use controlled public messages.

Internal errors are logged separately.

Logging protections include:

- request identifiers
- structured Pino logging
- credential and token redaction
- sanitized error serialization
- omission of request bodies and raw authorization headers
- omission of internal attachment storage keys from normal error context

Secrets must never be intentionally included in logging metadata.

## HTTP and browser security

The API uses:

- Helmet security headers
- production CORS restricted to `FRONTEND_URL`
- JSON request-size limits
- global API rate limiting
- stricter rate limits on authentication-sensitive endpoints
- configurable trusted-proxy handling

Health and readiness endpoints are intentionally mounted before the global API rate limiter so infrastructure health probes are not throttled.

Reverse-proxy trust is configured with `TRUST_PROXY`. Production defaults to one trusted proxy hop when the variable is unset. The configured value must match the actual deployment topology so client IP addresses and rate limiting cannot be influenced by untrusted forwarding headers.

Production `FRONTEND_URL` must use HTTPS.

## PostgreSQL security

Production PostgreSQL runs on Amazon RDS and is private-only.

Database access is restricted to the private Lightsail-to-RDS network path.

Hosted and production PostgreSQL connections use TLS.

Certificate verification defaults to enabled.

For databases using a private CA, configure:

`DATABASE_SSL_CA`

Disabling verification with:

`DATABASE_SSL_REJECT_UNAUTHORIZED=false`

should only be used when the database provider cannot provide a verifiable certificate.

Production `DATABASE_URL` must not embed SSL options such as `sslmode`, `sslcert`, `sslkey`, or `sslrootcert`, because Labfluss owns the production TLS configuration.

The production `DATABASE_URL` does not contain the PostgreSQL password.

The production database credential is managed by Amazon RDS through AWS Secrets Manager.

When database-secret integration is enabled, production uses:

```text
DATABASE_URL
DB_SECRET_ARN
DB_SECRET_REGION
DB_SECRET_ACCESS_KEY_ID
DB_SECRET_SECRET_ACCESS_KEY
```

Before Sequelize opens a new physical PostgreSQL connection, the backend retrieves the `AWSCURRENT` credential from the RDS-managed secret.

The dedicated database-secret runtime IAM identity is restricted to:

```text
secretsmanager:GetSecretValue
```

for the specific production RDS secret.

The runtime identity does not require general Secrets Manager enumeration or management permissions.

The database password must not be restored to `DATABASE_URL` as the normal credential mechanism.

## Production safeguards

Production startup validates:

- `NODE_ENV`
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

When `DB_SECRET_ARN` is configured in production, startup also requires:

- `DB_SECRET_REGION`
- `DB_SECRET_ACCESS_KEY_ID`
- `DB_SECRET_SECRET_ACCESS_KEY`

`NODE_ENV` must be one of:

- `development`
- `test`
- `production`

Automatic Sequelize schema synchronization is refused in production.

Production schema changes must use migrations.

Production Sequelize CLI operations use the Secrets Manager-aware wrapper at `src/scripts/runSequelizeCli.js`.

The wrapper retrieves the `AWSCURRENT` RDS credential from AWS Secrets Manager and exposes the credentialed database URL only to the child Sequelize CLI process. The production `DATABASE_URL` remains passwordless.

This production migration credential path was verified successfully on 2026-09-07 using `npm run migrate:status`.

Demo data seeding is refused in production unless explicitly enabled with:

`ALLOW_PRODUCTION_SEED=true`

That override should not normally be enabled on a real production deployment.

## Attachment storage configuration

Production attachments use private Amazon S3 storage.

Required production configuration includes:

```text
ATTACHMENT_STORAGE_PROVIDER=s3
S3_BUCKET_NAME
S3_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```

The production S3 credential uses a dedicated least-privilege IAM identity restricted to the Labfluss attachment bucket.

The runtime identity is permitted only the bucket and object operations required by Labfluss attachment workflows.

Account-wide S3 bucket enumeration is not required and is denied.

The production bucket must remain private.

Public bucket access must remain blocked.

Browser access uses short-lived presigned URLs rather than public objects or frontend AWS credentials.

Cloudflare R2 support remains in the backend only for historical and isolated non-production recovery/test workflows.

## Email configuration

Supported email modes are:

- `disabled`
- `mailgun`
- `ses`

Mailgun remains the active production provider until the Amazon SES production-access and cutover process is complete.

When Mailgun is enabled, the application validates the Mailgun API key, domain, sender address, and supported Mailgun API endpoint.

When Amazon SES is enabled, the backend uses dedicated SES credentials rather than the general S3 AWS credentials.

SES runtime configuration includes:

```text
SES_REGION
SES_ACCESS_KEY_ID
SES_SECRET_ACCESS_KEY
```

The production SES runtime IAM identity is restricted to:

```text
ses:SendEmail
```

for the verified labfluss.com SES identity.

The application does not require general SES identity-listing or IAM administration permissions.

## Dependency security

Dependencies are installed using the committed `package-lock.json`.

Use:

```bash
npm ci
```

for reproducible installs.

Do not automatically run:

`npm audit fix --force`

without reviewing the proposed dependency changes.

### Current dependency findings

The latest reviewed backend audit on 2026-09-07 reports:

```text
2 moderate vulnerabilities
```

Both findings are associated with the same transitive dependency path:

```text
sequelize@6.37.8
└── uuid@8.3.2
```

The `uuid` advisory affects versions below 11.1.1 and concerns missing buffer-bound checks in UUID v3, v5, and v6 operations when a caller provides a buffer.

Labfluss does not directly depend on or call `uuid`. The vulnerable version is inherited transitively through Sequelize 6.

npm's automated remediation requires:

```powershell
npm audit fix --force
```

and proposes downgrading Sequelize to 3.30.0.

That is a breaking and unacceptable remediation for the current application architecture.

The finding is therefore accepted temporarily as a moderate transitive dependency risk and should be reviewed during normal dependency maintenance or when Sequelize provides a compatible upstream resolution.

A separate `qs` advisory identified during the same review was remediated successfully by updating the compatible transitive dependency from `qs@6.15.2` to `qs@6.16.0`.

Do not use `npm audit fix --force` to remediate the remaining Sequelize/uuid finding.

### Required production practices

Production deployments should:

- use HTTPS at the public endpoint
- store secrets only in restricted backend environment or secret-management configuration
- never commit `.env`
- keep the production `.env` restricted to the service account
- keep the production RDS database private
- verify PostgreSQL TLS certificates
- keep production `DATABASE_URL` passwordless
- retrieve the current RDS credential through AWS Secrets Manager
- use least-privilege IAM identities for database-secret, S3, and SES access
- keep the Amazon S3 attachment bucket private
- restrict CORS to the production frontend
- configure the correct reverse-proxy trust level
- create or confirm an appropriate recovery point before meaningful schema migrations
- do not reinsert the RDS password into `DATABASE_URL` merely to run Sequelize CLI
- run production Sequelize CLI operations through the committed Secrets Manager-aware npm migration scripts rather than bypassing the wrapper
- run `npm ci` from the committed lockfile
- run the backend regression test suite before deployment
- review `npm audit` findings individually
- review accepted transitive dependency risks periodically and when upstream ORM updates become available

## Database credential-rotation resilience

A production incident on 2026-09-05 demonstrated the importance of separating process liveness from service readiness.

During the incident:

- the Node.js process remained running
- `/api/health` remained HTTP 200
- PostgreSQL authentication failed after an automatic RDS credential rotation
- `/api/ready` returned HTTP 503
- Better Stack detected the readiness outage

The original production configuration stored the RDS password statically inside `DATABASE_URL`.

The permanent remediation removed the database password from `DATABASE_URL` and added runtime retrieval of the `AWSCURRENT` credential through AWS Secrets Manager.

The remediation was verified by performing another database-secret rotation without restarting the backend. Post-rotation readiness remained HTTP 200 and no database authentication or Secrets Manager authorization failures were observed during the verification window.

### Security testing

The backend regression suite includes tests covering:

- authentication
- authorization
- tenant isolation
- password reset
- email verification
- JWT session invalidation
- request validation
- attachment authorization
- attachment content validation
- attachment upload/finalization security
- attachment cleanup
- sensitive-response field omission
- error redaction
- production configuration
- PostgreSQL TLS configuration
- reverse-proxy configuration
- database setup production safeguards
- Helmet security-header delivery
- API rate-limit middleware and standardized rate-limit headers
- Secrets Manager database-secret parsing and validation
- production database-secret configuration validation
- Sequelize `beforeConnect` database-secret integration
- credential redaction for database-secret AWS access keys
- Sequelize CLI production credential-wrapper behavior
- passwordless production migration environment handling

Run:

`npm test -- --runInBand`

before security-sensitive releases.

### Reporting security issues

Do not report suspected vulnerabilities by placing production secrets, access tokens, passwords, or private customer data in public issues.

If Labfluss is operated by an organization, security reports should be sent through that organization's designated private security-contact channel.
