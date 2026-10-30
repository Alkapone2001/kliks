# API and Sandbox Requirements

**Status:** Provider-neutral evaluation requirements, not invented API specifications.  
**Gate:** BLOCKED. No provider, real endpoint, credential, account or access grant has been supplied.

## Evidence Before Adapter Design

DOCS-01 requires authentic, versioned documentation from the actual institution/provider, covering the proposed customer and merchant scope. Record issuer, permitted access/use, version/effective date, environments, institution/account/rail coverage, and known differences between test and production. A public marketing page, copied sample JSON, country-level payment announcement or generic open-banking specification is not proof of this provider's support or KLIKS access.

SANDBOX-01 additionally requires an explicit access grant and approved synthetic-data test-account route. Store secret material outside Git/model prompts and retain only an authorized reference. Do not probe production endpoints, enroll real accounts, email credentials, or deploy development actor-ID routes publicly to obtain access.

## Capability Checklist for Provider Responses

| Capability               | Required clarification/evidence                                                                                                                             | Register                          |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| Institutional scope      | Actual legal counterparty, authorization scope, supported institutions/accounts, domestic EUR and merchant use cases; direct versus mediated access.        | PARTNER-01, DOCS-01               |
| Environments/access      | Authentic sandbox/base endpoints, synthetic test users/accounts, onboarding approval, network/certificate requirements and test/production differences.     | SANDBOX-01, SECURITY-01           |
| Client authentication    | Supported token/certificate/key lifecycle, scopes, rotation/revocation, permissions and secure delivery. No protocol is assumed.                            | CONSENT-01, SECURITY-01           |
| Customer/account consent | Provider-hosted or other approved consent/account-selection flow, ownership evidence, eligibility, scope, expiry, renewal and disconnect behavior.          | CONSENT-01                        |
| Payment authorization    | Actual institution authorization/SCA boundary, native/browser return binding, amount/beneficiary integrity, expiry, abandonment, rejection and recovery.    | CONSENT-01                        |
| Initiation               | Authentic request/response schema, source/destination references, amount units, currency, limits, fees and required disclosures.                            | DOCS-01, STATUS-01                |
| Idempotency              | Key/client-reference scope, lifetime, exact retry/conflicting reuse and recovery if a response/reference is lost.                                           | ERRORS-01                         |
| Status/finality          | Every state and transition, authoritative versus provisional status, execution/settlement distinction, later returns/corrections and permitted user claims. | STATUS-01                         |
| Notifications/query      | Authenticated callbacks or status-query route, ordering, retries, deduplication, freshness, correlation, unknown/not-found semantics and availability.      | STATUS-01, ERRORS-01, SECURITY-01 |
| Failure semantics        | Error taxonomy, timeouts, rate limiting, service outage, partial success and safe retry/escalation behavior.                                                | ERRORS-01                         |
| Reports/reconciliation   | Correlation fields, export/report availability, time zones, reconciliation authority, delayed corrections and discrepancy escalation.                       | STATUS-01, PARTNER-01             |
| Cancellations/disputes   | Which pending actions are cancellable, cutoffs, recalls/returns/refunds if supported, liability, complaint evidence and operational ownership.              | DISPUTES-01                       |
| Data handling            | Permitted stored/displayed fields, consent/processing roles, retention/deletion, hosting/subprocessors, transfers and support/audit restrictions.           | PRIVACY-01                        |
| Commercial/operational   | Fees, limits, support/on-call/escalation, service levels, onboarding/certification, change/deprecation and termination.                                     | PARTNER-01, SECURITY-01           |

Unsupported or undocumented capabilities must be marked unsupported/unknown, not replaced with guessed endpoints or a mock named after a real institution.

## Current Connector Gaps

The [current connector](../../apps/api/src/modules/banking/bank-connector.ts) intentionally models a deterministic simulation:

- Results carry `simulation: true`; they do not represent authentic provider responses.
- Authorization accepts `APPROVE`/`REJECT` and a selectable mock outcome, not a genuine customer/institution authorization artifact.
- Provider references and account references are synthetic, not proof of account ownership/consent or institution participation.
- Status results and the internal payment-state machine do not establish a provider's finality, unknown-outcome, return or dispute semantics.
- Mock calls can participate in local database transactions. A real network side effect cannot be rolled back by PostgreSQL, so copying this orchestration is unsafe without provider idempotency/recovery design.

Phase 12 may require a reviewed connector contract/state mapping and a superseding architecture decision. Do not remove the simulation marker, accept provider access in development actor-ID flows, or make mock outcomes authoritative for external payments to bypass these gaps. Preserve the mock as a separate test path.

## Provider-State Mapping Worksheet

Complete from authentic documentation, not the current mock enum. For each provider state/event, record:

1. Provider state/event name, version and source section.
2. Meaning: received, consent required, authorized, submitted, executed, settled, rejected, returned, unknown or other documented outcome.
3. Authoritative evidence source and correlation/ownership checks.
4. Whether it is terminal, can be corrected/returned later, and when a customer-facing success claim is justified.
5. Proposed KLIKS state/event mapping, legal/operational review and any architecture/schema change required.
6. Safe next action after missing/delayed/conflicting evidence and the institution escalation route.

Never collapse initiation acceptance, a browser return, a timeout or temporary not-found result into a final financial success/failure without evidence. A return/refund must be an explicit supported correction process, not reopening/relabeling an existing terminal record.

## Sandbox Acceptance Scenarios to Agree

These are planned scenarios, not tests run or evidence of access. Record which are supported, how to trigger them using synthetic accounts, expected provider evidence, and the accountable verifier before Phase 12 execution.

| Scenario                                           | Expected question/outcome to establish                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Authorized connection and approved payment         | Eligible test account/beneficiary, genuine consent/authorization evidence, accepted-to-final status mapping and correlation. |
| Wrong identity/account or tenant                   | External account access cannot be granted by changing a client user ID or QR reference.                                      |
| Consent expiry/revocation/disconnect               | Documented failure and recovery, no stale authorization reuse.                                                               |
| Customer rejection/abandonment                     | No false success; execution status remains recoverable and accurately displayed.                                             |
| Exact duplicate/concurrent initiation              | Provider-supported deduplication and one financial instruction, within documented key scope/lifetime.                        |
| Conflicting key reuse                              | Explicit provider rejection or agreed handling; no silent change of recipient/amount.                                        |
| Timeout after submission / lost response           | Recover the original intent even if its provider reference was not returned; never blindly duplicate.                        |
| Delayed/missing/out-of-order notification          | Authenticate, correlate, deduplicate and recover using the authoritative source.                                             |
| Tampered/replayed callback or redirect             | Reject untrusted evidence without advancing financial state or disclosing data.                                              |
| Insufficient funds/ineligible account/limit        | Distinguish authorization, institution execution and provisional outcomes using authentic error/state evidence.              |
| Recipient change/QR substitution/merchant mismatch | The approved account/beneficiary and amount remain bound to customer confirmation; no alias-based account takeover.          |
| Provider unavailable/rate-limited                  | Safe bounded retry and escalation without assuming execution failure.                                                        |
| Report discrepancy or later return                 | Link corrections to the original record and use agreed reconciliation/dispute ownership.                                     |
| Cancel/recall/refund where supported               | Confirm scope, permissions, cutoff and separate financial records; unsupported operations stay unavailable.                  |

## Sandbox Isolation and Exit Criteria

- Explicitly authorized synthetic data/accounts and least-privilege credentials only; never obtain secrets through chat or commit them with evidence.
- Isolated environments, permitted endpoints and safe logging; agree how to avoid accidental production submission and how to revoke access.
- No changes to public deployment/firewall/tunnel settings are authorized by this package.
- Do not label scenario rows passed before actual permitted execution and reviewer inspection of authentic results.
- A future successful sandbox exercise is limited evidence of technical behavior, not a license, institution endorsement, production certification or release approval.

Only after all applicable prerequisite evidence is accepted and a scoped human decision/Phase 12 approval exists should adapter implementation be considered. Operations/reconciliation and production hardening remain separate later gates.
