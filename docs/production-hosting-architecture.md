# LabFlow Production Hosting Architecture

**Version:** 1.0
**Decision date:** 2026-08-29
**Scope:** Initial United States paid pilot

## 1. Decision

LabFlow will use Amazon Web Services as the target production infrastructure platform for the initial paid pilot.

The migration will be performed incrementally rather than through a single full-platform cutover.

## 2. Target Architecture

- Frontend: AWS Amplify Hosting
- Backend: AWS Lightsail
- Database: Amazon RDS for PostgreSQL
- Attachments: Amazon S3
- Transactional email: Amazon SES
- Monitoring and logs: Amazon CloudWatch
- DNS: Amazon Route 53

Where practical, production resources will be deployed in the Europe (Frankfurt) AWS Region.

## 3. Initial Database Configuration

The initial production database target is:

- Amazon RDS for PostgreSQL
- PostgreSQL 17
- db.t4g.micro
- Single-AZ deployment
- 20 GiB gp3 storage
- storage encryption enabled
- automated backups enabled
- deletion protection enabled
- Frankfurt region

The database may temporarily permit restricted external connectivity while the existing Render backend is migrated.

The final target state is private database access from AWS-hosted application infrastructure.

## 4. Initial Backend Configuration

The initial backend target is:

- AWS Lightsail
- Linux
- 2 GB RAM
- 2 vCPU
- Frankfurt region

The backend will continue to use the existing Node.js and Express application.

The Lightsail host will require documented operating-system maintenance, application deployment, process supervision, reverse-proxy, TLS, firewall, monitoring, and recovery procedures.

## 5. Architecture Rationale

The AWS architecture was selected based on:

- lower projected monthly infrastructure cost at pilot scale;
- predictable Lightsail pricing;
- lower RDS cost compared with the required always-available Neon configuration;
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

ECS or another managed container platform may be reconsidered as LabFlow grows.

## 7. Migration Strategy

Migration will occur in the following order:

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

Each stage must be validated before the next production dependency is migrated.

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

Moving infrastructure to AWS does not by itself make LabFlow HIPAA compliant, FERPA certified, ITAR compliant, or suitable for other regulated data classes.

## 10. Status

**Target production cloud:** AWS

**Architecture decision:** Approved

**Migration strategy:** Incremental

**Next phase:** 26C.1 AWS RDS Migration
