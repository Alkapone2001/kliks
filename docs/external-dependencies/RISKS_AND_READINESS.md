# Risks and Integration Readiness

**As of:** 2026-10-30  
**External gate:** BLOCKED  
**Decision:** No real connector, real-account testing, real payment or production deployment is approved.

## Blocking Risk Register

All entries are open. Role labels below identify who must own the question; they do not identify an appointed person or an accepted partner obligation. The founder must assign actual accountable people and obtain competent external review.

| Risk                                                      | Exposure                                                                                           | Required mitigation/evidence                                                                                    | Proposed accountable reviewer                | Gate                              |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | --------------------------------- |
| R-01 Legal model unconfirmed                              | Operating an unpermitted service despite a no-custody intention.                                   | Actual entity/features, qualified local legal review and competent regulatory route.                            | Founder + qualified counsel                  | LEGAL-01, AUTHZ-01                |
| R-02 No identified authorized partner                     | Invented access, unsupported banking/merchant scope or incorrect institutional claims.             | Genuine counterparty, authorization/coverage evidence and agreed duties/terms.                                  | Founder + partner compliance/business        | PARTNER-01                        |
| R-03 No authentic API/sandbox access                      | Designing against fictional interfaces or touching real accounts without permission.               | Versioned docs, permitted synthetic sandbox access and secure credential process.                               | Partner technical/security + engineering     | DOCS-01, SANDBOX-01               |
| R-04 Development actor IDs treated as authorization       | Cross-user/account access or merchant staff escalation.                                            | Approved customer/tenant/account binding, consent and recovery design.                                          | Security + partner authentication lead       | CONSENT-01, SECURITY-01           |
| R-05 Directory/phone misbinding or unlawful processing    | Enumeration, recycled-number takeover, privacy violations or wrong recipient.                      | Applicable privacy assessment, opt-in/reassignment controls, accepted institution binding and responsibilities. | Counsel/privacy + partner                    | PRIVACY-01, CONSENT-01            |
| R-06 Ambiguous execution/retries                          | Duplicate debit, false failure/success or untraceable intent.                                      | Provider idempotency/client reference, state/finality and timeout recovery contract.                            | Engineering + partner operations             | STATUS-01, ERRORS-01              |
| R-07 Unauthenticated status/callbacks                     | Forged success, replay, cross-transaction binding or lost corrections.                             | Authentic notification/query security, correlation, freshness and reconciliation rules.                         | Partner security + engineering               | SECURITY-01, STATUS-01, ERRORS-01 |
| R-08 Merchant scope/beneficiary mismatch                  | Development profile or personal owner account misrepresented as a business collection arrangement. | Legal business/representative/account verification and permitted merchant roles/flow.                           | Partner onboarding/compliance + counsel      | PARTNER-01, LEGAL-01              |
| R-09 Unknown complaints/dispute/refund liability          | Unsupported promises or unauthorized financial record rewrites.                                    | Accepted cancellation/return/refund/dispute process, liability and support route.                               | Partner operations/legal + founder           | DISPUTES-01                       |
| R-10 Unreviewed data/secrets/hosting                      | Credential exposure, unlawful transfer/retention or security incident.                             | Agreed data roles and lifecycle, secure storage, access, hosting and incident requirements.                     | Privacy/security + partner                   | PRIVACY-01, SECURITY-01           |
| R-11 Unsupported speed/availability/cost claims           | Misleading users or an uneconomic/unreliable service.                                              | Institution/rail coverage, limits, pricing, service levels and supported disclosures.                           | Founder + partner operations/business        | PARTNER-01, STATUS-01             |
| R-12 Treating a prototype/test report as release approval | Premature connector/production work without an accountable decision.                               | Evidence-backed scoped human gate, architecture decision and explicit later-phase approval.                     | Founder + legal/security/technical reviewers | DECISION-01                       |

No test count, generic web article, unchecked assumption, mock success, self-signed approval placeholder or informal conversation closes these risks. Additional risks must be added as genuine evidence reveals them.

## Evidence Acceptance

An item can move from MISSING to a reviewed accepted state only when the accountable human reviewer can verify its authentic issuer, version/date, applicability to the actual legal entity/provider/features/environment, permitted use/access, and outstanding conditions. Record the review rationale and a redacted or protected evidence reference. A signature/identity is not authenticated merely because its name is typed into this file.

Public discovery sources can be recorded as background without satisfying an external prerequisite. Provider documentation alone does not establish a contract or authorization; sandbox access alone does not establish a legal operating model; legal guidance on one feature does not approve every feature or jurisdiction. Negative or contradictory evidence keeps affected work blocked until competently resolved.

Never copy secrets or restricted/unredacted evidence into Git or model prompts. If a necessary reference is protected, identify its custodian and review route without exposing its contents. A private credential being withheld from this package is correct; an unverified claim that it exists is not accepted evidence.

## Gate Checklist

All external checklist items below are currently unchecked. The document preparation checklist is separate; its completion must not change this gate.

- [ ] LEGAL-01: Actual legal entity/jurisdiction and case-specific qualified review of all proposed features recorded.
- [ ] AUTHZ-01: Competent applicable authorization/registration/partner route and conditions documented; required permissions established for the next scoped step.
- [ ] PARTNER-01: Genuine authorized counterparty identified; accepted functions, responsibilities, merchant arrangement, limits, costs, support and exit conditions recorded.
- [ ] DOCS-01: Authentic current API/environment documentation covers the proposed flow, including institution/account/rail eligibility.
- [ ] SANDBOX-01: Explicit access grant and synthetic-data/account process reviewed; secrets held outside the repository/model context.
- [ ] CONSENT-01: Customer/provider authentication, account ownership, consent/authorization, expiry/revocation, callback and recovery responsibilities understood.
- [ ] PRIVACY-01: Applicable data/alias-directory basis, roles, notices, lifecycle, number reassignment, hosting/transfers and rights requirements reviewed.
- [ ] STATUS-01: Authoritative status, execution/finality, notifications/query, reports and correction semantics understood, with no unsupported timing/scheme claim.
- [ ] ERRORS-01: Idempotency, ambiguous outcomes, retries, duplicate/conflicting messages and escalation rules documented.
- [ ] DISPUTES-01: Cancellation, recalls/returns/refunds if supported, complaints, disputes and liability responsibilities agreed.
- [ ] SECURITY-01: Provider security/onboarding requirements and sandbox isolation/secret-management plan reviewed; later production obligations explicitly remain gated.
- [ ] DECISION-01: Named human review of prerequisite evidence, scoped decision, explicit Phase 12 approval and reviewed superseding architecture decision recorded.

## Phase 12 Entry Decision Template

**Current outcome: NOT APPROVED. The blank fields below are not an approval record.**

- Actual legal entity/jurisdiction: NOT PROVIDED.
- Institution/provider legal entity and accepted scope: NOT PROVIDED.
- Evidence requirement IDs and authentic protected/redacted references: NOT PROVIDED.
- Qualified legal/regulatory conclusion, issuer/date and remaining conditions: NOT PROVIDED.
- Business/compliance/security/technical accountable reviewers: NOT APPOINTED.
- Authorized environment/data/accounts and sandbox scope: NOT PROVIDED.
- Confirmed authentication/status/error/dispute semantics: NOT PROVIDED.
- Architecture changes required, including replacement of mock-only contract assumptions: NOT REVIEWED.
- Residual risks, explicit restrictions and later release gates: NOT ACCEPTED.
- Review decision, approver, date and explicit Phase 12 authorization: NOT APPROVED.

Possible review outcomes are blocked, further evidence required, rejected, or a precisely scoped approval for the next authorized step. Production release and real money movement require their own genuine permissions and later gates; they must never be implied by a sandbox adapter approval.

An applicable approval must be accompanied by a reviewed superseding decision under [ADR 0006](../decisions/0006-mock-only-until-external-approval.md); do not change that accepted decision or bind a real connector merely because this template exists. The no-wallet decision also remains in force.

## Stop Conditions

Stop and retain the mock-only path if any of the following occurs:

1. Entity/provider, authorization route, authentic docs/access or accountable review is absent or unverifiable.
2. Someone proposes credentials in code/chat, unauthorized endpoint probing, real-account testing under development IDs, a public tunnel/deployment, or removing simulation labels to obtain access.
3. Funds would enter KLIKS custody, a fictional balance would be shown, or an account/beneficiary binding cannot be established under the reviewed model.
4. The provider cannot explain unknown execution, safe retry/finality or dispute responsibilities, or its behavior contradicts the current mapping.
5. A new legal/security/privacy restriction or a change to scope/institutions/version invalidates prior evidence.
6. A party treats an inquiry, public page, demo, test, sandbox invitation or blank checklist as authorization or certification.

Escalate through the founder to the competent legal/institution/security reviewer. Do not work around the blocker by inventing APIs, bank-specific mocks, compliance rules or optimistic payment states.

## Current Handoff

Engineering can prepare this package and keep the simulated MVP working. The founder must supply the actual entity/contact, identify and engage qualified legal/regulatory and institution/provider counterparts, and obtain authentic documentation/access and responsibilities. No correspondence was sent and no partner evidence was received in this task. Phase 11 remains open for external evidence; Phase 12 is not started.
