# Institution Questions and Outreach Drafts

**Status:** Questions prepared; not sent; no institutional answers received.  
**Gate:** BLOCKED. This document is not legal advice or a licensing determination.

Use the [product/data flow](PRODUCT_AND_DATA_FLOW.md) and [responsibility proposal](RESPONSIBILITIES_AND_SECURITY.md) as attachments after founder/legal review. Ask the recipient to state which questions they are competent to answer and refer the remainder to the appropriate authority. Request written, dated, scoped answers with authentic document references; do not infer agreement from silence or a meeting invitation.

## Verified Public Routing Source

The official [CBK contact page](https://bqk-kos.org/kontakti/) was retrieved on 2026-10-30. It listed the Department for Licensing and Standardization and the institutional address `bqk.licencimi@bqk-kos.org`. It also listed the general information address `info@bqk-kos.org`. These are public routing references, not confirmation of the correct case officer, an accepted application, a legal conclusion or KLIKS authorization. Recheck the page before sending. Do not send secrets, banking data, personal identity documents or unredacted contracts through an unapproved channel.

No individual employee contact is needed or assigned here. No candidate provider/contact has been supplied. Obtain a genuine institution introduction through the founder; do not invent a partner or guess an employee address.

## Questions for CBK or the Competent Financial Authority

1. **CBK-01 / LEGAL-01, AUTHZ-01:** For the attached no-custody flow, how should KLIKS activities be classified separately for alias discovery, account connection, payment initiation, payment requests, bill splitting and merchant collection? Which activities require authorization, registration, an appointed/outsourced/agent arrangement or another formal route? Please identify the applicable legal provisions and conditions rather than assuming a category.
2. **CBK-02 / LEGAL-01:** What legal entity, establishment, governance, fit-and-proper, capital/insurance or local-presence requirements, if any, apply to each viable route? Which authority is competent for each determination?
3. **CBK-03 / AUTHZ-01, PARTNER-01:** Can the described service operate through an appropriately authorized partner, and if so under what contractual, supervisory, notification and customer-disclosure conditions? Which obligations remain with KLIKS and cannot be delegated?
4. **CBK-04 / AUTHZ-01:** Which currently effective laws, regulations, guidelines, application forms and transition dates should counsel assess? Are translations authoritative? Please distinguish current requirements from proposals or announcements; do not assume an EU regime automatically applies.
5. **CBK-05 / PARTNER-01, STATUS-01:** Which institution/rail participation arrangements could support the proposed domestic EUR bank-to-bank flow, if any? Does participation require an institution/intermediary rather than direct access by KLIKS? What must be established before making any instant-payment, scheme-access or timing claim?
6. **CBK-06 / PARTNER-01, CONSENT-01:** Who must perform customer/business identification, account ownership checks, AML/CFT/sanctions monitoring and fraud controls under the proposed arrangement? What evidence may each party rely on, and what escalation/reporting duties remain with KLIKS?
7. **CBK-07 / CONSENT-01:** What customer authentication, strong authentication if applicable, consent, delegated-access, transaction-binding and recovery obligations apply? Is the proposed institution/provider authorization boundary acceptable, and what evidence is required?
8. **CBK-08 / PRIVACY-01:** What constraints apply to an opt-in phone/username recipient directory, opaque QR references, alias reassignment and number recycling? Which privacy authority or legal process should determine data roles, basis, retention and cross-border transfer obligations?
9. **CBK-09 / LEGAL-01, PARTNER-01:** What additional conditions apply to merchant collection, business-account eligibility, legal-beneficiary verification, authorized staff and static/dynamic QR? The prototype routes to a development owner's mock account; what actual business/beneficiary structure would be required instead?
10. **CBK-10 / DISPUTES-01:** What consumer/merchant information, complaint, unauthorized-payment, cancellation, return/refund, dispute and liability obligations apply to the proposed roles? Who is responsible for customer-facing timelines and escalation?
11. **CBK-11 / SECURITY-01:** Which security assurance, audit, outsourcing/cloud, incident notification, continuity, access-control or reporting requirements apply? Are prior approvals or specific certifications required, and from whom?
12. **CBK-12 / PRIVACY-01, SECURITY-01:** What record categories, evidential integrity, reporting and retention/deletion obligations apply, and how should conflicting legal/security/customer-rights requirements be resolved by the appropriate reviewers?
13. **CBK-13 / STATUS-01, PARTNER-01:** What disclosures or restrictions concern fees, limits, execution time, availability, name/account matching and transaction finality? What evidence is needed before marketing those properties?
14. **CBK-14 / SANDBOX-01:** Is there an applicable supervisory testing/innovation route, and what are the entry criteria and limits? Does any supervised test permit only synthetic data, and what approvals are needed before real users/accounts or public availability?
15. **CBK-15 / DECISION-01:** What is the correct formal submission/routing process, required evidence package, accountable contact role and decision scope? How should KLIKS distinguish an informational response from a binding authorization or approval, and identify any outstanding conditions?

## Questions for a Candidate Institution or Provider

1. **PROV-01 / PARTNER-01:** What is your legal entity, authorization and relevant institutional coverage, and which of the attached proposed functions are you genuinely willing and authorized to support for KLIKS? Please provide an authentic scope reference and responsible business/compliance contact.
2. **PROV-02 / LEGAL-01, PARTNER-01:** Which contract/operating arrangement would apply, which party is accountable for execution and onboarding, and what conditions must be satisfied before sandbox versus production access? How are merchant legal beneficiaries and business accounts verified?
3. **PROV-03 / DOCS-01:** Provide current versioned API/OpenAPI documentation, changelog, environments, supported institutions/account types, EUR/rail coverage and deprecation policy. Are endpoints direct, partner-mediated or subject to institution-specific availability?
4. **PROV-04 / SANDBOX-01, SECURITY-01:** How do we obtain explicitly authorized sandbox access and synthetic payer/payee/business accounts? What isolation, network/certificate, credential delivery, rotation, test-data and rate-limit requirements apply? Supply credentials only through the agreed secure channel, not this repository or chat.
5. **PROV-05 / CONSENT-01:** What authentication, customer account-selection, account-ownership, consent, scope, renewal, expiry, revocation and disconnect lifecycle is supported? What must KLIKS store, and what must never leave your boundary?
6. **PROV-06 / CONSENT-01:** Describe the exact browser/native authorization sequence, redirect/universal-link requirements if any, SCA responsibility and any permitted exemptions. How are consent, payer, source account, beneficiary, amount, currency, device/session and callbacks bound and verified?
7. **PROV-07 / DOCS-01, ERRORS-01:** What are payment request/response schemas, amount units and limits, required recipient details, client-reference rules and idempotency guarantees? State key scope, retention, conflicting reuse behavior and safe actions after timeout or connection loss.
8. **PROV-08 / STATUS-01:** List every initiation/authorization/execution/finality/return status and its exact meaning. Which statuses are authoritative or terminal, can they later change, and which support a customer-facing success claim? Does accepted mean only received, not executed or settled?
9. **PROV-09 / ERRORS-01, STATUS-01:** How do we recover an unknown execution outcome? Can we query by an idempotency/client reference if no provider reference was returned? What are eventual-consistency windows, retention limits, manual escalation and safe retry rules?
10. **PROV-10 / SECURITY-01, ERRORS-01:** Which notification/webhook/polling methods are supported? Provide authentication/signing, freshness, retry, deduplication, correlation, ordering and endpoint-verification requirements, including behavior when notifications are missing or conflicting.
11. **PROV-11 / STATUS-01:** What reconciliation exports/reports, timestamps, identifiers and correction records are available? Which source resolves discrepancies, and what support process applies to missing or contradictory records?
12. **PROV-12 / DISPUTES-01:** What cancellation/recall, rejection, return/refund, unauthorized-payment and dispute processes exist? Distinguish reversible pending actions from new financial corrections; identify cutoffs, liability and permissions without assuming card-style chargebacks apply.
13. **PROV-13 / PRIVACY-01:** What data may KLIKS process/retain/display, under which proposed roles and permitted purposes? Specify hosting/transfer/subprocessor, consent, retention, audit/support and rights requirements; does the proposed alias directory require a separate agreement?
14. **PROV-14 / PARTNER-01, SECURITY-01:** Define fraud/AML/KYC, customer complaints, monitoring, outage/incident communication, escalation owners and response/service-level responsibilities. What work must KLIKS perform itself?
15. **PROV-15 / PARTNER-01:** What fees, minimum volumes, institution/account coverage limits, settlement/availability constraints, commercial dependencies and exit/termination obligations apply? Which remain different between sandbox and production?
16. **PROV-16 / SECURITY-01, DECISION-01:** What certification, security testing, onboarding, change approval and go-live reviews are required? Who can approve the scope and evidence, and what production gates remain after a successful sandbox integration?

## Questions for Qualified Legal and Privacy Reviewers

1. **REVIEW-01 / LEGAL-01, AUTHZ-01:** For the actual entity and proposed features, which legal instruments and authorization paths apply, and which competent institutions must decide? Record assumptions, effective dates, uncertainties and features excluded from the opinion.
2. **REVIEW-02 / PRIVACY-01:** Which laws and data roles/bases apply to aliases, phone verification/reassignment, customer/account references, merchants/staff, payment metadata and support/audit records? Is explicit opt-in sufficient for any purpose, or what else is required?
3. **REVIEW-03 / PRIVACY-01:** What notices, rights, retention/deletion, number-recycling, international transfer/hosting, security and breach obligations apply? Do not assume a retention period or a foreign regulatory regime without an applicable source.
4. **REVIEW-04 / PARTNER-01, DISPUTES-01:** Are the proposed provider contracts, merchant beneficiary arrangements, liability, complaints/disputes, refund limits and termination duties consistent with the accepted operating model?
5. **REVIEW-05 / SECURITY-01:** Which independent technical/security assessments and assurance evidence are required before sandbox, real-account testing and public launch respectively? Distinguish design review from certification and operational readiness.
6. **REVIEW-06 / DECISION-01:** Which conditions are satisfied, unresolved or prohibitive, who is accountable, and what exact bounded next step can be approved? Please do not describe documentation preparation or an informal discussion as authorization to process real payments.

## Unsent CBK Routing Draft

**Do not send until the founder supplies the legal entity/contact and a qualified reviewer clears the content. No outreach is performed by this task.**

**To:** confirm the current licensing/routing channel on the official CBK contact page.  
**Subject:** Request for guidance on a proposed no-custody payment interaction service in Kosovo

We are preparing KLIKS, currently a local simulated prototype, for evaluation of a possible domestic EUR payment interaction service. Our proposed flow is alias/QR discovery, explicit recipient-and-amount confirmation, and authorization through an appropriately authorized institution/provider. We do not currently initiate real payments, hold funds, operate a wallet, collect bank passwords, or claim regulatory approval.

Our proposed legal entity is [LEGAL ENTITY AND JURISDICTION NOT PROVIDED]. The responsible business contact is [NAME, ROLE AND APPROVED CONTACT NOT PROVIDED]. Attached are a product/data-flow description, proposed responsibilities and the CBK questions above.

Please advise the appropriate department/process and applicable authorization/partner route for the described functions, identify any preliminary submission requirements, and clarify which questions require another competent authority or professional reviewer. We would welcome written, scoped guidance with relevant current source references. We are not requesting that this draft be treated as an approved application or authorization.

## Unsent Institution/Provider Draft

**Recipient:** [GENUINE INSTITUTION/PROVIDER CONTACT NOT PROVIDED]. Do not substitute an invented partner name or guessed personal address.  
**Subject:** Capability and sandbox discussion for proposed KLIKS account-to-account flow

KLIKS is a local simulated prototype exploring recipient discovery, requests, bill sharing and merchant collection without custody or a stored-value balance. Before considering a real integration, we need to establish whether your institution can support the attached domestic EUR flow under an appropriate agreed operating model.

Please review the provider questions above and indicate supported functions/coverage, authorization and responsibility requirements, authentic versioned technical documentation, a permitted synthetic-data sandbox route, and the business/compliance/security contacts able to assess them. No production access or real-account testing is requested by this message. Credentials and restricted material should be shared only through an agreed secure channel.

Our legal entity, responsible contact and any regulatory assessment must be supplied and reviewed before sending. A capability discussion or sandbox invitation will not be recorded as regulatory approval or permission for public launch.

## Answer Capture

For each numbered question, record: question ID, respondent's institution/role, response date, exact bounded answer or authorized redacted reference, cited source/version/effective date, related evidence requirement ID, reviewer, accepted conclusion and outstanding conditions. Mark unanswered/referral/contradictory items as such. No blank or optimistic placeholder counts as evidence.
