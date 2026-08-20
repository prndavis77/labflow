# LabFlow Security

## Security model

LabFlow is a multi-tenant laboratory project-management application.

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

LabFlow uses JWT bearer authentication.

JWTs:

- are signed using `JWT_SECRET`
- include issuer `labflow-api`
- include audience `labflow-web`
- expire according to the application token policy
- include `tokenVersion` so server-side account or password changes can invalidate older sessions

Production requires a `JWT_SECRET` of at least 32 characters.

Password hashes are never included in API responses.

## Account security

LabFlow includes:

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

Production `FRONTEND_URL` must use HTTPS.

## PostgreSQL security

Hosted and production PostgreSQL connections use TLS.

Certificate verification defaults to enabled.

For databases using a private CA, configure:

`DATABASE_SSL_CA`

Disabling verification with:

`DATABASE_SSL_REJECT_UNAUTHORIZED=false`

should only be used when the database provider cannot provide a verifiable certificate.

Production `DATABASE_URL` must not embed SSL options such as `sslmode`, `sslcert`, `sslkey`, or `sslrootcert`, because LabFlow owns the production TLS configuration.

## Production safeguards

Production startup validates:

- `NODE_ENV`
- `DATABASE_URL`
- `JWT_SECRET`
- `FRONTEND_URL`

`NODE_ENV` must be one of:

- `development`
- `test`
- `production`

Automatic Sequelize schema synchronization is refused in production.

Production schema changes must use migrations.

Demo data seeding is refused in production unless explicitly enabled with:

`ALLOW_PRODUCTION_SEED=true`

That override should not normally be enabled on a real production deployment.

## Attachment storage configuration

When Cloudflare R2 storage is enabled, LabFlow requires:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET_NAME`

R2 endpoints must use HTTPS.

Buckets should remain private.

## Email configuration

Supported email modes are:

- `disabled`
- `mailgun`

When Mailgun is enabled, the application validates the Mailgun API key, domain, sender address, and supported Mailgun API endpoint.

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

### Current accepted dependency risk

As of August 20, 2026, npm audit reports two moderate findings associated with:

`sequelize@6.37.8 -> uuid@8.3.2`

The advisory affects `uuid` versions below 11.1.1.

The vulnerable dependency is transitive through Sequelize 6.

The npm automatic force-fix proposes downgrading Sequelize to 3.30.0, which is a breaking and unacceptable change.

Until Sequelize provides a compatible upstream resolution, this finding is tracked as an accepted transitive dependency risk and should be reviewed during dependency maintenance.

### Required production practices

Production deployments should:

- use HTTPS at the public endpoint
- store secrets in the hosting platform's secret/environment system
- never commit .env
- use a private PostgreSQL database where possible
- verify database TLS certificates
- use a private R2 bucket
- restrict CORS to the production frontend
- configure the correct reverse-proxy trust level
- apply migrations before application rollout
- run npm ci from the committed lockfile
- run the backend regression test suite before deployment
- review npm audit findings

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

Run:

`npm test -- --runInBand`

before security-sensitive releases.

### Reporting security issues

Do not report suspected vulnerabilities by placing production secrets, access tokens, passwords, or private customer data in public issues.

If LabFlow is operated by an organization, security reports should be sent through that organization's designated private security-contact channel.
