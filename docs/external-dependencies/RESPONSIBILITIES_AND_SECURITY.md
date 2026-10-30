# Responsibilities and Security Assumptions

**Status:** Proposed discussion matrix; no row is accepted by an institution or legal reviewer.  
**Gate:** BLOCKED; see [evidence register](EVIDENCE_REGISTER.json).

## Responsibility Proposal

Do not treat the suggested lead below as an assignment, outsourcing agreement, legal conclusion or exemption. The founder must obtain named accountable parties, interfaces, contracts and escalation routes. Shared work must still have a clearly identified accountable entity.

| Area                                          | Proposed KLIKS contribution                                                            | Confirmation required from institution/provider and reviewers                                                                                  |
| --------------------------------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Legal operating model                         | Describe features, customers, data and no-custody constraint accurately.               | Applicable classification, authorization/registration route, entity requirements, permitted functions and supervisory responsibilities.        |
| Customer identity/account ownership           | Bind an authenticated KLIKS user to approved external account/consent references.      | Who performs KYC/AML/sanctions/fraud checks, what KLIKS must perform, and what identity/account evidence may be relied on.                     |
| Bank authentication and payment authorization | Initiate only under documented consent; preserve customer intent and callback binding. | Who authenticates the customer, performs SCA if applicable, authorizes the bank instruction and owns exceptions/recovery.                      |
| Alias directory                               | Maintain lawful opt-in aliases, minimize disclosure and handle changes/recycling.      | Legal basis, data controller/processor roles, institution acceptance, name/account matching and dispute/reassignment controls.                 |
| Provider account connection                   | Use approved account-selection and consent lifecycle interfaces.                       | Eligible accounts, scopes, validity, renewal, revocation, disconnect and downstream ownership checks.                                          |
| Payment execution                             | Create correlated/idempotent intents and consume authoritative statuses.               | Authorized execution mechanism, institution/rail coverage, finality, cancellation, limits, fees and actual movement of funds.                  |
| Requests, bills and merchant QR               | Show recipient/amount and require each payer's separate authorization.                 | Which collection/request/merchant functions are permitted, who verifies the legal business and beneficiary account, and any extra obligations. |
| Customer support/complaints                   | Offer the agreed contact, capture safe correlation data and route issues.              | Who owns execution complaints, refunds/returns, unauthorized-payment claims, disputes, liability and response deadlines.                       |
| Security and incidents                        | Protect KLIKS services/allowed data, detect misuse and follow escalation rules.        | Required assurance/certification/testing, incident reporting recipients/timings and provider joint-response obligations.                       |
| Data protection                               | Minimize and protect permitted data; honor agreed rights/retention processes.          | Applicable laws, data roles/bases, notices, rights, retention, cross-border transfers, hosting/subprocessors and regulator contacts.           |
| Reconciliation/operations                     | Correlate KLIKS records with approved provider reports and investigate discrepancies.  | Authoritative source, access rights, reconciliation cadence/exports, unknown-state handling, support coverage and outage communication.        |
| Commercial/exit                               | Track provider/version/cost dependencies and migration risks.                          | Pricing, liability caps, service levels, termination, consent/token/data handling and continuity obligations.                                  |

## Current Prototype Is Not a Security Baseline for Launch

| Current implementation                                                          | Consequence before external use                                                                                                               |
| ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Client-supplied development identity IDs and saved identity switcher.           | Not production authentication, authorization or account ownership. They must never grant access to external accounts.                         |
| In-app synthetic verification codes; no production SMS or identity proofing.    | No KYC or reliable recovery/number-reassignment guarantee.                                                                                    |
| Development-only guards returning not found outside explicit test/development.  | Useful isolation, not a production permission model or a substitute for deployment controls.                                                  |
| Local API/Expo LAN preview and unresolved Windows firewall access.              | Local testing only. Do not open firewall rules publicly, add a public tunnel or deploy to obtain partner access.                              |
| In-process lookup throttling.                                                   | Not a multi-instance abuse/fraud/privacy defense.                                                                                             |
| Phone/alias directory, merchant roles, bill membership and QR constraints.      | Tested simulation behavior, not an accepted legal/business identity or fraud design.                                                          |
| Mock outcomes chosen by the test client and `simulation: true` connector types. | Incompatible with treating a browser outcome as provider evidence. Real state transitions must originate in authenticated provider semantics. |
| Database transaction around deterministic mock connector calls.                 | Does not make an external network side effect atomic. Provider idempotency/recovery and failure ownership require a separate reviewed design. |
| Audit rows, state transitions and integration tests.                            | Evidence of implementation behavior, not penetration testing, immutable regulatory records, certification or operational readiness.           |
| Android/iOS exports and responsive browser tests.                               | Not physical-device validation, provider certification or approval for public release.                                                        |

## Security Assumptions Requiring Review

1. No credential collection: bank passwords, OTPs, private signing keys and provider tokens never enter QR payloads, client storage, ordinary logs, support screenshots or model prompts. Document any necessary secret handling only after authentic provider requirements are known.
2. Authentication/authorization: define customer identity, session expiry, device/account recovery, tenant scoping and staff access. Every externally scoped account/payment action must derive ownership server-side from an approved authenticated context, not a supplied user ID.
3. Consent and intent binding: bind payer, authorized account, recipient, amount, currency, consent scope and callback/session. Require explicit review and approved institution authorization. Protect callback/redirect integrity, expiry, revocation and replay according to provider documentation.
4. Provider trust: authenticate outbound requests and inbound status/notifications using supported mechanisms; verify source, freshness and correlation. No unauthenticated webhook, browser return or QR value may assert payment success.
5. Idempotency/recovery: obtain exact duplicate/retention/retry guarantees. A timeout is not proof that no transfer executed. Do not invent a cryptographic protocol or rely solely on a local unique key to protect external funds.
6. Recipient privacy/fraud: review alias enumeration, recycled numbers, SIM swap, misbinding, merchant impersonation, QR substitution, malicious staff and beneficiary changes. Explicit discovery opt-in does not alone establish lawful processing or safety.
7. Data/security operations: identify environment separation, least-privilege storage/access, encryption/key management, audit controls, monitoring, incident response, backups and restoration requirements. Do not claim a certification, retention schedule or notification deadline without a source.
8. Supply chain/client security: assess dependencies, native permissions, app signing/distribution, hosted assets, redirect handlers and secure transport. The current Lucide CDN and local preview choices are development facts, not a reviewed production third-party/availability model.
9. Sandbox isolation: use only explicitly authorized synthetic accounts/data, segregated credentials and permitted endpoints. Do not attach real accounts to development actor-ID flows. No public deployment or production traffic is authorized by sandbox access.
10. Production boundary: Phase 12, if genuinely enabled, is a scoped provider integration step; it does not waive Phase 13 operations or Phase 14 security/hardening and release gates.

## Evidence and Approval Needed

Resolve LEGAL-01, AUTHZ-01 and PARTNER-01 before treating any proposed role as accepted. CONSENT-01, PRIVACY-01 and SECURITY-01 must identify reviewer, scope, source, accountable parties and any remaining launch blockers. Operational/status/error/dispute responsibilities must also match STATUS-01, ERRORS-01 and DISPUTES-01. A commercial contact's informal statement is not a substitute for the competent legal/security/operational decision.

No security-sensitive code, real connector, authentication mechanism, secret store, cloud deployment, legal registration or institutional outreach is implemented by this document.
