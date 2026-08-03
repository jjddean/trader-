# UK Customs Product Gap Assessment

**Status:** Saved product research  
**Research date:** 3 August 2026  
**Purpose:** Record the capabilities FreightCode needs beyond its current CDS declaration workflow, including current obligations, conditional product scope and emerging UK policy.

## Executive conclusion

FreightCode is developing a strong declaration workspace, but a serious customs operating platform must also manage the movement, payment, authorisation and regulatory-change lifecycle around each declaration.

The fixed priority order is:

1. Regulatory rules and code-list update pipeline.
2. Complete CDS payment and accounting, including CDSI.
3. Representation authority and PAS 41201 controls.
4. ENS / Safety and Security GB.
5. GVMS.
6. Northern Ireland, UKIMS and Windsor Framework correctness.
7. NCTS Phase 5.
8. UK CBAM readiness.
9. Special procedures, authorisations and guarantees.
10. SPS / IPAFFS.
11. Fiscal-representative workflows when the low-value-import policy is final.

## Fiscal representatives for overseas marketplaces

The July 2026 low-value-import consultation proposes that overseas sellers and online marketplaces without a UK physical presence may have to appoint a UK-established fiscal representative to continue sending low-value imports to the UK.

The representative could become jointly and severally liable for customs debts and potentially VAT debts. This is not yet an operative requirement.

This role is distinct from:

- a customs representative submitting declarations directly or indirectly;
- a VAT representative HMRC can require certain non-established businesses to appoint; and
- online-marketplace deemed-supplier VAT liability.

### FreightCode position

Prepare a data model for:

- overseas seller or marketplace identity;
- UK-established representative;
- appointment dates, scope and termination;
- direct, indirect or fiscal capacity;
- liability limits and guarantees;
- consignment-level debt exposure; and
- historical responsibility and audit evidence.

Do not advertise FreightCode as the liable fiscal representative unless the business has deliberately accepted the legal and financial exposure, with suitable legal advice, insurance, capital and operational controls.

## CDSI and immediate payments

A CDSI reference is a unique 16-character immediate-payment reference generated for a CDS declaration. It is not required for every declaration.

HMRC immediate-payment methods are selected through DE 4/8. Immediate-payment codes must not be mixed with non-immediate methods on one declaration.

FreightCode already contains:

- a declaration-level `paymentMethodCode`;
- DE 4/8 XML mapping; and
- some payment-method validation.

The remaining product work is:

1. Present the valid payment methods with appropriate explanations.
2. Enforce immediate-payment consistency across all items.
3. Parse and store the CDSI reference returned by HMRC.
4. Display the amount, reference, payment deadline and payment route.
5. Track unpaid, paid, expired and clearance status.
6. Retain payment events in the declaration audit history.
7. Support cash accounts, duty deferment, PVA and guarantee accounts.
8. Record the authority allowing a broker to use a client account.
9. Reconcile estimates, HMRC-confirmed charges, payments and statements.

## Current high-priority product gaps

### 1. Regulatory-change pipeline

Build:

- automated monitoring of HMRC code lists, Tariff Volume 3 instructions and API/schema releases;
- effective-from and effective-to dates;
- independent GB and XI rulesets;
- release-impact reporting;
- regression declarations for rule changes;
- controlled approval and publication of rule versions; and
- a production warning or submission block when critical rules are stale.

This is the highest priority because document codes, status rules, procedure instructions and NI/EU requirements change frequently.

### 2. Representation and intermediary controls

Translate PAS 41201:2026 and representation requirements into:

- client appointment and authority records;
- direct and indirect representation scope;
- customer instruction evidence;
- competency and reviewer controls;
- conflict and escalation records;
- mandatory review stages;
- correction and complaint handling;
- service-level reporting; and
- an exportable evidence pack.

### 3. ENS / Safety and Security GB

Since 31 January 2025, goods imported from the EU to Great Britain generally need an Entry Summary Declaration.

Required product scope:

- S&S GB enrolment and OAuth;
- ENS creation using the reduced dataset;
- submit, amend and invalidate operations;
- response and rejection handling;
- linkage to the related consignment and customs declaration;
- carrier or representative responsibility; and
- audit history.

Indicative build: 6–10 weeks plus HMRC testing and onboarding.

### 4. GVMS

Required product scope:

- create and update Goods Movement References;
- attach declaration, transit and other movement references;
- validate route and port requirements;
- monitor GMR status and inspection outcomes;
- support haulier collaboration; and
- retain movement history.

Indicative build: 5–8 weeks plus HMRC access and testing.

### 5. Northern Ireland and Windsor Framework

An XI EORI field is not full Northern Ireland support.

Required product scope:

- separate GB and XI tariff and validation contexts;
- UKIMS eligibility and not-at-risk treatment;
- EU document codes and CERTEX constraints;
- NI preference and origin rules;
- GB-to-NI and rest-of-world-to-NI scenarios;
- parcel and B2C movement rules; and
- explicit regression coverage for NI-specific changes.

### 6. NCTS Phase 5

Required for customers moving goods under the Common Transit Convention.

Required product scope:

- transit declarations;
- commodity codes at the correct consignment level;
- pre-lodgement and amendment;
- multiple house consignments;
- offices of departure, transit, incident and destination;
- guarantees and authorisation references;
- MRN and movement status;
- arrival and unloading messages; and
- business continuity records.

Indicative build: 10–16 weeks plus HMRC conformance testing.

### 7. Special procedures, authorisations and guarantees

Support:

- inward processing;
- outward processing;
- temporary admission;
- customs warehousing;
- authorised use / end use;
- simplified and supplementary declarations;
- authorisation by declaration;
- individual and comprehensive guarantees;
- reference-amount monitoring; and
- discharge and re-export evidence.

### 8. SPS / IPAFFS

For food, animal, plant and other controlled goods:

- capture IPAFFS and CHED references;
- coordinate health certificates and supporting documents;
- connect border-control outcomes to the shipment;
- identify missing pre-notification before customs submission; and
- add direct integration later if commercially justified.

## New and emerging policies

### UK CBAM — starts 1 January 2027

Build during 2026:

- identify CBAM commodity codes;
- aggregate rolling 12-month import value;
- warn before the £50,000 registration threshold;
- collect weight, producer and embedded-emissions evidence;
- retain the customs tax point and declaration reference;
- apply published quarterly rates; and
- produce return-ready records and audit exports.

### UK–India FTA — in force from 15 July 2026

Add:

- current preference measures and document codes;
- India-specific origin declaration templates;
- exporter EORI and registered-email linkage;
- shipment-specific authentication evidence;
- unique reference number capture;
- importer’s-knowledge evidence; and
- record-retention and retrospective-claim workflows.

### Low-value-import fiscal representative — consultation

Monitor the consultation and legislative outcome. Design the underlying appointment and liability model, but do not launch the liable service before the rules are final.

## Product classification

### Must-have for FreightCode's current CDS declaration claim

- current and effective-dated declaration rules;
- complete payment methods and CDSI where immediate payment applies;
- account authority and customs accounting;
- reliable HMRC response and document handling;
- representation evidence; and
- controlled production readiness and audit history.

### Must-have before claiming end-to-end UK border operations

- ENS / S&S GB;
- GVMS;
- NCTS5 for transit customers;
- NI / UKIMS / Windsor Framework support where XI movements are offered;
- special-procedure lifecycle support; and
- SPS/IPAFFS coordination for controlled goods.

### Strategic adjacent capabilities

- UK CBAM;
- UK–India origin workflows;
- marketplace seller verification;
- fiscal-representative administration; and
- wider VAT compliance.

## Sources

- [Reforming the customs treatment of low value imports](https://www.gov.uk/government/consultations/reforming-the-customs-treatment-of-low-value-imports-into-the-united-kingdom/reforming-the-customs-treatment-of-low-value-imports-into-the-united-kingdom)
- [Online marketplace VAT rules](https://www.gov.uk/guidance/charging-vat-when-goods-are-sold-if-youre-an-online-marketplace-operator)
- [Pay for imports declared using CDS](https://www.gov.uk/guidance/pay-for-imports-declared-using-the-customs-declaration-service)
- [DE 4/8 method-of-payment codes](https://www.gov.uk/government/publications/method-of-payment-codes-for-data-element-48-of-the-customs-declaration-service)
- [CDS account authorities](https://www.gov.uk/guidance/set-up-or-view-an-authority-on-the-customs-declarations-service)
- [Safety and Security GB API guide](https://developer.service.hmrc.gov.uk/guides/safety-and-security-import-declarations-end-to-end-service-guide/)
- [EU-to-GB ENS requirements](https://www.gov.uk/government/publications/preparing-for-the-new-safety-and-security-declaration-requirements/get-ready-for-safety-and-security-declaration-requirements-for-importing-goods-from-the-eu)
- [Goods Vehicle Movement Service](https://www.gov.uk/government/collections/goods-vehicle-movement-service)
- [NCTS Phase 5 final-state rules](https://www.gov.uk/government/publications/community-common-transit-and-tir-newsletters/january-2025-ncts-phase-5-final-state-rules)
- [Customs Intermediaries Standard / PAS 41201:2026](https://www.gov.uk/government/publications/standard-for-customs-intermediaries)
- [Current national CDS document codes](https://www.gov.uk/guidance/data-element-23-documents-and-other-reference-codes-national-of-the-customs-declaration-service-cds)
- [Current Union CDS document codes](https://www.gov.uk/government/publications/data-element-23-documents-and-other-reference-codes-union-of-the-customs-declaration-service-cds)
- [UK CBAM policy summary](https://www.gov.uk/government/publications/carbon-border-adjustment-mechanism-cbam-policy-summary/carbon-border-adjustment-mechanism-cbam-policy-summary)
- [UK CBAM registration threshold](https://www.gov.uk/guidance/work-out-the-date-youll-need-to-register-for-carbon-border-adjustment-mechanism-cbam)
- [UK–India FTA rules of origin](https://www.business.gov.uk/campaign/alive-with-opportunity/the-uk-india-trade-deal/rules-of-origin/)

## Review rule

Recheck this assessment whenever HMRC publishes a CDS schema release, Tariff Volume 3 update, fiscal event, border-policy consultation outcome or implementation-date change. At minimum, review monthly through January 2027.
