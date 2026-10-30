# External Readiness Package

**As of:** 2026-10-30  
**Preparation:** PREPARED
**External gate:** BLOCKED  
**Scope:** Phase 11 preparation only. No real connector, real payment, production deployment, or regulatory approval.

KLIKS is a simulated payment interaction prototype, not a licensed institution, wallet, proven payment rail, or approved operating model. Completing this package does not complete the external gate. Public material and internal proposals cannot substitute for case-specific institutional guidance, qualified legal review, an identified authorized partner, and authentic provider documentation/access.

## Package Contents

| Document                                                          | Purpose                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [Product and data flow](PRODUCT_AND_DATA_FLOW.md)                 | Current simulation versus proposed real flow, data inventory, trust boundaries and failure paths. |
| [Responsibilities and security](RESPONSIBILITIES_AND_SECURITY.md) | Proposed responsibilities, assumptions requiring agreement, and existing security gaps.           |
| [Institution questions](INSTITUTION_QUESTIONS.md)                 | Exact CBK, partner and privacy/legal questions, with unsent outreach drafts.                      |
| [API and sandbox requirements](API_AND_SANDBOX_REQUIREMENTS.md)   | Capabilities and evidence needed before designing a real adapter.                                 |
| [Risks and readiness](RISKS_AND_READINESS.md)                     | Blocking risks, evidence acceptance rules, review checklist and decision template.                |
| [Evidence register](EVIDENCE_REGISTER.json)                       | Machine-readable record of missing external prerequisites and the blocked decision.               |

## Current Evidence Position

- Registered legal entity, founder contact, candidate institution and provider: not supplied.
- Case-specific regulatory/legal assessment, partner responsibilities and authorization: not supplied.
- Authentic provider API contract, approved sandbox access, authentication/status/error/dispute semantics: not supplied.
- The local application, tests, mock accounts, synthetic identities and merchant profiles demonstrate software behavior only. They are not external approval, identity verification, bank access, or proof of production security.
- No institution has been contacted through this task; no message has been sent and no agreement or approval has been obtained.

## Evidence Rules

Use the stable requirement IDs in the register when recording answers. For every proposed answer, retain an authentic source reference, issuer/contact role, scope, document version/effective date, date obtained, reviewer, conclusion, and remaining conditions. Distinguish published facts, institution statements, legal advice, internal proposals, and unresolved questions. Record contradictions rather than choosing a convenient answer.

Keep credentials, tokens, private keys, bank/account details, personal identity documents, restricted contracts and unredacted correspondence out of Git and model prompts. Store protected material in an access-controlled repository and record only an authorized redacted reference here. Do not invent evidence IDs, links, signatures or named contacts.

## Order of Work

1. Founder supplies the proposed legal entity/jurisdiction, intended market/features, and a responsible business contact. Do not use a mock merchant profile as legal identity.
2. Obtain qualified local legal/compliance advice and use the exact questions to seek the appropriate CBK/institution route. Ask who is competent to answer each question; absence of a reply is not consent.
3. Identify an institution/provider genuinely willing and authorized to support the proposed flow. Obtain its current documentation, responsibilities, commercial conditions and approved synthetic-data sandbox route.
4. Review the documented authentication, consent, data, payment status, retry/error, dispute and operational semantics against the package. Update proposals to match evidence, not the reverse.
5. Record a named human gate decision. If required evidence is absent, contradictory or outside scope, keep the gate BLOCKED. Phase 12 additionally requires explicit approval and a reviewed superseding decision for the mock-only boundary.

## Public Source Discovery

The [Central Bank of the Republic of Kosovo website](https://bqk-kos.org/) and its [official contact page](https://bqk-kos.org/kontakti/) were retrieved on 2026-10-30 as primary-source discovery/routing points. The contact page listed the licensing department channel recorded in the questionnaire. These sources do not establish KLIKS eligibility, a particular legal interpretation, availability of partner APIs, access to a payment scheme, or authorization. No law number, licensing category or effective date is asserted without an authenticated applicable source. Both source references are in the evidence register; neither satisfies a case-specific prerequisite.

## What This Task Cannot Complete

This repository cannot issue licenses, establish a legal entity, sign agreements, obtain private bank access, authenticate a founder's identity, or make institutional decisions. The founder and qualified external reviewers must supply the missing evidence. The preparation package has been validated for formatting, relative references, coverage of all 12 prerequisite IDs and a blocked/no-approval register. This is documentation validation, not legal or provider review. Passing the external gate remains a separate, evidence-based human decision.
