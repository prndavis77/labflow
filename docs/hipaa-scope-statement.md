# Labfluss HIPAA Scope Statement

**Version:** 1.0
**Applies to:** Initial United States paid pilot program
**Last reviewed:** 2026-09-04

## 1. Purpose

This document defines the HIPAA-related scope and restrictions that apply to the initial Labflow paid pilot.

Labflow is a project-management and laboratory-workflow platform intended for university research laboratories.

For the initial paid pilot, Labflow is not offered as a system for storing, transmitting, maintaining, or otherwise processing Protected Health Information or electronic Protected Health Information subject to the Health Insurance Portability and Accountability Act of 1996 and its implementing regulations.

This statement should be read together with:

- `pilot-data-policy.md`
- `privacy-policy.md`
- `data-inventory.md`
- `retention-policy.md`
- `subprocessor-inventory.md`
- applicable customer agreements and institutional policies

## 2. HIPAA Regulatory Boundary

The HIPAA Privacy, Security, and Breach Notification Rules apply to covered entities and, in relevant circumstances, their business associates.

A software provider may become a HIPAA business associate when it creates, receives, maintains, or transmits Protected Health Information on behalf of a HIPAA covered entity or another business associate.

For the initial Labflow paid pilot:

- Labflow is not intended to act as a HIPAA business associate;
- Labflow does not offer HIPAA-regulated processing as part of the pilot;
- Labflow does not enter into Business Associate Agreements for the initial pilot unless the service and contractual framework are specifically changed in the future; and
- customers must not use Labflow to create, receive, maintain, transmit, upload, or otherwise process PHI or ePHI.

## 3. Prohibited HIPAA-Regulated Data

Customers and users must not enter or upload PHI or ePHI into Labflow.

This includes information that is both:

1. individually identifiable health information; and
2. protected under HIPAA because of the circumstances in which it is created, received, maintained, or transmitted.

Examples of information that must not be entered into Labflow when it constitutes PHI include:

- patient names associated with health information;
- medical record numbers;
- patient diagnoses;
- treatment information;
- clinical test results;
- patient laboratory results;
- prescription information;
- health insurance information;
- billing information linked to an individual's health care;
- identifiable clinical research information obtained from a HIPAA covered entity;
- medical images containing identifying information;
- health records or extracts from electronic health record systems;
- patient consent documentation containing identifiable health information; and
- attachments containing identifiable patient health information.

The fact that information relates to biology, medicine, health, or biomedical research does not by itself determine whether it is PHI.

The customer is responsible for determining whether information is subject to HIPAA before entering it into Labflow.

## 4. Research Data

HIPAA does not prohibit research generally.

Research laboratories may use Labflow for ordinary research workflow information that is permitted under the Labflow Pilot Data Policy and that does not constitute PHI or ePHI requiring HIPAA-regulated handling.

Examples that may be appropriate, subject to institutional and contractual requirements, include:

- experimental plans;
- non-human research data;
- laboratory equipment information;
- reagent and materials information;
- protocols;
- non-identifiable project notes;
- non-PHI research attachments;
- administrative project information;
- task assignments; and
- properly de-identified information where the institution has determined that the information is no longer PHI under applicable requirements.

Researchers must not assume that removing a name alone makes health information de-identified.

The institution or researcher responsible for the data must determine whether health information has been properly de-identified before it is entered into Labflow.

## 5. De-Identified Health Information

HIPAA permits health information that has been properly de-identified under applicable HIPAA requirements to be used or disclosed without being treated as PHI under the Privacy Rule.

Labflow may be used for properly de-identified research information only when:

- the applicable institution has determined that the information satisfies its required de-identification standard;
- the information is permitted by institutional policies, research agreements, consent requirements, and other applicable restrictions;
- no prohibited identifiers are reintroduced into Labflow; and
- the information otherwise complies with the Labflow Pilot Data Policy.

Labflow does not independently certify that customer-provided information has been properly de-identified.

## 6. Business Associate Agreements

Labflow does not offer a Business Associate Agreement as part of the initial paid pilot.

A customer must not transmit PHI or ePHI to Labflow on the assumption that:

- use of encryption alone removes HIPAA obligations;
- the data is permitted because Labflow cannot readily interpret it;
- the information is permitted because access is restricted;
- the information is permitted because an attachment is privately stored; or
- the information is permitted because a downstream cloud provider offers HIPAA-capable services.

HIPAA obligations depend on the processing relationship and the nature of the information, not merely on whether the information is encrypted or difficult for a service provider to access.

If a future customer requires Labflow to create, receive, maintain, or transmit ePHI on its behalf, that use case must not proceed under the initial pilot configuration.

## 7. Infrastructure and Subprocessors

Labflow uses third-party infrastructure and service providers to operate the service.

The fact that an individual provider may offer HIPAA-eligible products or may enter into BAAs with some customers does not make the overall Labflow service HIPAA-ready.

HIPAA support would require a separate review of, at minimum:

- the Labflow service architecture;
- every provider that could create, receive, maintain, or transmit ePHI;
- applicable provider BAAs;
- subcontractor relationships;
- administrative safeguards;
- physical safeguards;
- technical safeguards;
- access controls;
- audit controls;
- authentication;
- transmission security;
- risk analysis;
- risk management;
- incident response;
- breach-notification procedures;
- backup and disaster-recovery procedures;
- data retention and deletion;
- workforce policies and training; and
- customer contractual requirements.

No representation should be made that Labflow is HIPAA compliant based solely on individual infrastructure-provider capabilities.

## 8. Security Controls Do Not Expand the Permitted Data Scope

Labflow currently implements security controls including:

- authentication;
- role-based authorization;
- organization and tenant isolation;
- password hashing;
- token hashing;
- TLS-protected network communications;
- database transport security;
- private object storage;
- short-lived signed attachment URLs;
- attachment validation;
- audit logging;
- sensitive-data log redaction;
- backup and recovery procedures; and
- availability monitoring.

These safeguards support the general security of Labflow.

They do not constitute a representation that Labflow satisfies all requirements applicable to HIPAA-regulated systems.

Customers must continue to follow the prohibition on PHI and ePHI even where Labflow security controls would technically permit the information to be uploaded.

## 9. Customer Responsibilities

Before entering information into Labflow, the customer and its authorized users are responsible for:

- determining whether the information constitutes PHI or ePHI;
- complying with institutional privacy and information-security policies;
- complying with IRB, research-protocol, consent, sponsor, and contractual restrictions where applicable;
- ensuring that research data is appropriately de-identified where de-identification is relied upon;
- ensuring that Labflow is an approved system for the intended data; and
- preventing prohibited health information from being uploaded.

A customer's internal approval to use Labflow does not override this HIPAA Scope Statement unless Labflow has expressly agreed in writing to a different service scope.

## 10. Accidental Submission of PHI

If a user believes that PHI or ePHI has accidentally been entered into Labflow, the user or customer should:

1. stop further submission of the information;
2. avoid unnecessarily copying or redistributing the affected information;
3. notify the applicable institutional privacy or security contact as required by institutional policy;
4. notify Labflow through the designated security or privacy contact; and
5. provide sufficient information for Labflow to identify the affected organization and records without unnecessarily transmitting additional PHI.

Labflow will evaluate appropriate containment, deletion, preservation, notification, and other response actions based on the circumstances and applicable obligations.

An accidental submission does not expand Labflow's permitted data scope or convert the pilot into an approved HIPAA service.

## 11. No HIPAA Compliance Representation

For the initial paid pilot, Labflow must not be described as:

- HIPAA compliant;
- HIPAA certified;
- HIPAA approved;
- a HIPAA-ready storage system for PHI;
- an electronic health record system;
- a clinical record system; or
- a HIPAA business associate service.

Marketing materials, sales communications, customer onboarding materials, and support communications must remain consistent with this limitation.

## 12. Future HIPAA Support

Labflow may evaluate HIPAA support in a future product phase.

Before PHI or ePHI could be accepted, Labflow would need to complete a separate HIPAA readiness program that may include:

- legal review of covered-entity and business-associate relationships;
- execution of appropriate BAAs;
- provider and subprocessor review;
- formal HIPAA Security Rule risk analysis;
- documented risk-management measures;
- policy and procedure development;
- workforce access controls and training;
- incident and breach-response procedures;
- HIPAA-specific technical safeguards;
- retention and backup review;
- audit-control review; and
- contractual changes.

Until such a program is completed and Labflow expressly authorizes HIPAA-regulated use in writing, PHI and ePHI remain prohibited.

## 13. Relationship to Other Labflow Policies

This HIPAA Scope Statement supplements the Labflow Pilot Data Policy and Privacy Policy.

If another Labflow document appears to permit information that this statement prohibits, the more restrictive HIPAA-related limitation applies for the initial paid pilot unless Labflow expressly approves a different arrangement in writing.

## 14. Review and Change Management

This statement should be reviewed:

- before the first paid pilot;
- before onboarding a customer that conducts clinical or patient-related research;
- before accepting any request for a Business Associate Agreement;
- after material infrastructure or subprocessor changes;
- when the Labflow permitted-data scope changes; and
- at least annually.

Any proposal to permit PHI or ePHI must trigger a separate legal, security, infrastructure, and contractual review before the change is implemented.

## 15. Status

**Current HIPAA pilot scope:** PHI/ePHI prohibited.

**Business Associate Agreement offered:** No.

**Labflow represented as HIPAA compliant:** No.

**HIPAA-regulated system of record:** No.

**Review status:** Approved for the initial non-HIPAA paid-pilot scope.
