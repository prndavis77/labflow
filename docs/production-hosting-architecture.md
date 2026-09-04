# Labfluss Production Hosting Architecture

**Version:** 1.0
**Decision date:** 2026-08-29
**Scope:** Initial United States paid pilot

## 1. Decision

Labfluss uses Amazon Web Services as the primary production infrastructure platform for the initial paid pilot.

The migration was performed incrementally rather than through a single full-platform cutover.

## 2. Current and Target Architecture

Current production architecture:

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachments: Amazon S3
- Transactional email: Mailgun
- External uptime monitoring: Better Stack
- DNS: Amazon Route 53

Remaining target migrations:

- Transactional email: Mailgun to Amazon SES
- Monitoring/logging: further consolidation into Amazon CloudWatch where appropriate

Where practical, production resources will be deployed in the Europe (Frankfurt) AWS Region.

## 3. Initial Database Configuration

The production database configuration is:

- Amazon RDS for PostgreSQL
- PostgreSQL 17.11
- DB instance: `labflow-production`
- database: `labflow`
- db.t4g.micro
- Single-AZ deployment
- 20 GiB gp3 storage
- storage encryption enabled
- automated backups enabled
- backup retention: 7 days
- publicly accessible: No
- private Lightsail-to-RDS connectivity verified
- Frankfurt region (`eu-central-1`)

The production database is private-only and is reached from the AWS Lightsail backend through private VPC peering.

## 4. Initial Backend Configuration

The production backend configuration is:

- AWS Lightsail
- instance: `labflow-backend-production`
- Ubuntu 24.04 LTS
- 2 GB RAM
- 2 vCPU
- 60 GB SSD
- Frankfurt region
- Nginx reverse proxy
- HTTPS at `https://api.labfluss.com`
- systemd process supervision
- private connectivity to Amazon RDS

The backend continues to use the existing Node.js and Express application.

The Lightsail host requires documented operating-system maintenance, application deployment, process supervision, reverse-proxy, TLS, firewall, monitoring, and recovery procedures.

## 5. Architecture Rationale

The AWS architecture was selected based on:

- lower projected monthly infrastructure cost at pilot scale;
- predictable Lightsail pricing;
- lower projected RDS cost compared with the always-available Neon configuration evaluated at the time;
- consolidation of production infrastructure;
- simpler subprocessor and infrastructure review;
- availability of managed database, storage, email, monitoring, DNS, and frontend-hosting services;
- existing familiarity with AWS services; and
- a clear migration path from the current architecture.

The estimated AWS pilot baseline is approximately $30 to $35 per month at low usage, excluding exceptional data-transfer or usage growth.

The previously reviewed upgraded managed-stack estimate was approximately $67.52 per month.

These figures are planning estimates and must not be treated as guaranteed billing amounts.

## 6. Alternatives Considered

### Existing managed stack

- Vercel
- Render
- Neon
- Cloudflare R2
- Mailgun
- Better Stack

Advantages:

- lower operational burden;
- existing deployment already tested;
- less immediate migration work.

Disadvantages:

- higher projected monthly cost;
- more direct production providers;
- Neon free-plan capacity has already caused production database unavailability;
- separate upgrades would be required across several providers.

### ECS Express Mode

ECS Express Mode was evaluated for the backend.

It provides managed Fargate deployment, load balancing, autoscaling, and service recovery.

It was not selected for the initial pilot because its Fargate and load-balancer baseline is expected to cost materially more than Lightsail, while the pilot does not currently require horizontal container autoscaling.

ECS or another managed container platform may be reconsidered as Labfluss grows.

## 7. Migration Strategy and Status

Migration was planned in the following order:

1. Neon PostgreSQL to Amazon RDS
2. Render backend to AWS Lightsail
3. Vercel frontend to AWS Amplify
4. Cloudflare R2 attachments to Amazon S3
5. Mailgun transactional email to Amazon SES
6. monitoring consolidation into CloudWatch where appropriate
7. DNS and production-domain finalization
8. backup automation and recovery testing
9. final production smoke test
10. infrastructure sign-off

Current status:

- [x] Neon PostgreSQL to Amazon RDS
- [x] Render backend to AWS Lightsail
- [x] Vercel frontend to AWS Amplify
- [x] Cloudflare R2 attachments to Amazon S3
- [ ] Mailgun transactional email to Amazon SES
- [ ] further CloudWatch consolidation
- [x] DNS and production-domain finalization for `app.labfluss.com` and `api.labfluss.com`
- [ ] automated attachment backup and remaining recovery automation
- [x] production smoke testing for the migrated AWS frontend/backend/database stack
- [ ] final infrastructure sign-off

Each migration stage must be validated before retiring the prior production dependency.

## 8. Rollback Principle

Existing providers should not be decommissioned immediately after migration.

Where feasible, the previous service should be retained temporarily in a non-writing or standby state until the replacement has passed production validation.

## 9. Security and Compliance Boundary

The AWS migration does not change the permitted-data scope.

The initial pilot continues to prohibit unsupported regulated or restricted data as defined in the:

- Pilot Data Policy
- HIPAA Scope Statement
- FERPA Scope Statement
- Export-Control Restriction
- Security Safeguards document

Moving infrastructure to AWS does not by itself make Labfluss HIPAA compliant, FERPA certified, ITAR compliant, or suitable for other regulated data classes.

## 10. Status

**Primary production cloud:** AWS

**Architecture decision:** Approved

**Migration strategy:** Incremental

**Completed AWS migrations:**

- Amazon RDS production database
- AWS Lightsail backend
- AWS Amplify frontend
- Route 53 production DNS
- private Lightsail-to-RDS connectivity
- HTTPS custom production domains
- Amazon S3 production attachment storage

**Remaining infrastructure migrations:**

- Mailgun to Amazon SES
- further CloudWatch consolidation
- automated attachment backup and remaining recovery automation
- final infrastructure sign-off
