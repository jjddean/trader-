# FreightCode environment matrix

**Status:** ACTIVE  
**Governs:** Environment terminology, HMRC hosts, Accept headers, OAuth hosts, organisation HMRC routing concepts.  
**Does not govern:** CDS field meaning, XML mapping, or submission behaviour — those are [`AGENT-SPEC.md`](./AGENT-SPEC.md).

This file is the environment authority. Implementation may lag or disagree; do not rewrite this document to match code.

---

## Purpose

Stop collapsing these into one word such as “production” or “live”:

| Axis | What it answers |
|------|-----------------|
| FreightCode application | Which app deployment is running |
| HMRC CDS | Which HMRC declarations environment a submission targets |
| HMRC OAuth | Which HMRC identity/credential set authorises that call |
| Organisation routing | Which HMRC mode that organisation is permitted to use |
| External integrations | CNS, MCP/Destin8, and similar — their own test/live states |

**FreightCode is a live production application.** That fact does not set the HMRC CDS environment for every organisation or every declaration.

Two conclusions this document forbids:

- FreightCode is pre-production because TDR is in use.
- FreightCode is in production, therefore every declaration goes to HMRC CDS Live.

---

## Status words

| Term | Meaning in this file |
|------|----------------------|
| **Active** | Used by at least one approved FreightCode workflow or configuration. |
| **Supported** | Approved product capability. Does not imply current operational use. |
| **Configured** | Named configuration exists. Does not imply validated or in use. |
| **Unverified** | Repository or product text exists; current operational use is not established here. |
| **Not active** | Must not be treated as a current operational path. |
| **Archived** | Historical reference only. Not an implementation source. |

Do not use an unqualified “production is future” or “production is live.” Always name the subject.

Four claims that must stay separate:

| Claim | Meaning |
|-------|---------|
| Product intent | What FreightCode is supposed to support |
| Capability | What the product/architecture is approved to do |
| Current configuration | What named settings exist |
| Current operational use | What is actually being used now |

---

## Environment dimensions

### FreightCode application

**Current product status: FreightCode application — production — active.**

This is the SaaS product (Vercel / Convex and related app deploys). It is not TDR-only, not sandbox-as-the-product, and not pre-production.

Local development and preview deploys are application environments. They do not, by themselves, decide HMRC CDS routing.

### HMRC CDS

HMRC Customs Declaration Service environments FreightCode may address:

| CDS environment | Host | Legal effect (product) | Notes |
|-----------------|------|------------------------|--------|
| **TDR** (Test Data Repository) | `https://test-api.service.hmrc.gov.uk` | No legal clearance | Practice / test declarations with real trader data shapes |
| **CDS Live** | `https://api.service.hmrc.gov.uk` | Legally binding | Live customs |

**Trade Test** (vendor software assurance, Trade Test Data Library EORIs) used the sandbox host with a different API version. It is **archived**. Customers must not use TDL EORIs. Archive: `docs/hmrc/ARCHIVE/trade-test/`.

TDR and CDS Live share nothing with “FreightCode is in production” except that a production **application** may still send an organisation to TDR.

### HMRC OAuth / authentication

These are distinct from the CDS declarations host, even when they travel together for a given org mode:

| Piece | Sandbox / practice | Production / live |
|-------|--------------------|-------------------|
| Authorize (browser) | `https://test-www.tax.service.gov.uk` | `https://www.tax.service.gov.uk` |
| Token / API | `https://test-api.service.hmrc.gov.uk` | `https://api.service.hmrc.gov.uk` |
| Typical sign-in | HMRC Test User | Live Government Gateway |
| Developer Hub credentials | Sandbox application credentials | Production application credentials |

A sandbox client id is rejected by `api.service.hmrc.gov.uk`. Presence of a production host name or a production-named environment variable is **configured capability**, not proof that production OAuth is validated or that CDS Live is in operational use.

Connect troubleshooting (sandbox chain): [`oauth-connect-troubleshooting.md`](./oauth-connect-troubleshooting.md).

### Organisation routing

**Product intent** ([`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md)): HMRC mode is **per organisation**, not per FreightCode deployment.

| Org mode (product language) | CDS target | OAuth set |
|-----------------------------|------------|-----------|
| **Practice** | TDR on the sandbox host | Sandbox |
| **Live** | CDS Live on the production host | Production |

- A **FreightCode platform admin** enables Live for an organisation. It is not a customer self-serve toggle.
- **Product intent for new organisations:** start in Practice.
- Application production does not force every organisation onto CDS Live.
- Do not promote an organisation from Practice to Live merely because CDS Live is a supported capability.

Granularity: **organisation**. Declaration-level HMRC environment is not an approved product model. Implementation may still expose a global deployment fallback; that is a limitation, not a second product rule. Whether every tenant is already independently routed is **unverified** (the customer guide still records a global-env limitation alongside the per-org model).

### External integrations

CNS and MCP/Destin8 each have their own test / UAT / live states.

They are independent of FreightCode application production and of HMRC CDS routing.

- CNS launch sequence: [`AGENTS.md`](../../../../AGENTS.md). Build plan: `docs/cns/plan/`.
- MCP/Destin8: independently tracked (`CLAUDE.md` §3). This matrix does not define their hosts.

Do not infer CNS or MCP “live” from FreightCode production or from CDS Live.

---

## Current environment matrix

### FreightCode application

| Subject | Status |
|---------|--------|
| FreightCode application | **Production — active** |

### HMRC CDS

| Subject | Product intent | Capability | Configuration | Operational use |
|---------|----------------|------------|---------------|-----------------|
| TDR on sandbox host (`test-api`) | Practice / testing / validation / onboarding / org Practice mode | Supported | Named hosts and TDR v1 Accept headers below | **Active** for Practice / TDR work (authoritative TDR path) |
| CDS Live (`api.service.hmrc.gov.uk`) | Live customs for orgs enabled for Live | Supported as the Live target | Production host and separate production credential **names** exist | **Unverified** — do not treat as currently used by any organisation unless a later operational record says so |
| Trade Test v2.0 | Vendor-only historical path | Not for new work | — | **Archived** |

Cutover material for HMRC production-host / CDS Live credentials lives under `docs/hmrc/FUTURE/production/`. That folder is **not** a statement that FreightCode the application is pre-production. Do not start cutover work from it unless asked.

### HMRC OAuth

| Subject | Status |
|---------|--------|
| Sandbox authorize + token hosts | **Supported** and used with Practice / TDR |
| Production authorize + token hosts | **Supported** as the Live pairing |
| Production Developer Hub credentials issued and validated | **Unverified** |
| Sandbox credentials usable on the production API host | **Not active** (must not be used) |

### API versions and Accept headers

TDR on the sandbox host (current Practice / TDR reference):

| Operation | Accept |
|-----------|--------|
| Submit / amend / cancel | `application/vnd.hmrc.1.0+xml` |
| Status (Information API, sandbox host) | `application/vnd.hmrc.1.0+xml` |
| Pull notifications | `application/vnd.hmrc.1.0+xml` |

CDS Live (product pairing when an organisation is Live): Declarations **v2.0** and production-host Information **v2.0** Accept values (`application/vnd.hmrc.2.0+xml` unless a named override is set). That pairing is **supported** product intent. It is **not** proof of operational CDS Live use.

Override names (configuration only): `HMRC_DECLARATIONS_ACCEPT`, `HMRC_INFORMATION_ACCEPT`, `HMRC_ACCEPT_V1_XML`, `HMRC_ACCEPT_V2_XML`.

### Configuration names (not values)

Do not put secrets in this file. Next.js and Convex do not share env.

Deployment / credential **names** (see `CLAUDE.md` §9):

`HMRC_ENVIRONMENT`, `HMRC_CLIENT_ID` / `HMRC_CLIENT_SECRET`, `HMRC_SANDBOX_*`, `HMRC_PRODUCTION_*`, `HMRC_SANDBOX_BASE_URL`, `HMRC_PRODUCTION_BASE_URL`, `HMRC_REQUIRE_ORG_LIVE_ON_PROD`, `HMRC_ALLOW_LIVE_ON_SANDBOX_DEPLOY`.

`HMRC_ENVIRONMENT=sandbox` vs `production` describes **deployment HMRC credential/host selection**, not FreightCode application production status.

`NEXT_PUBLIC_HMRC_ENV` is a phase label used by implementation. It must not be read as “the app is only TDR.”

---

## Data policy

| CDS environment | Party / account data |
|-----------------|----------------------|
| Trade Test (archived) | Trade Test Data Library EORIs — vendor only |
| TDR | Real declarant EORI, DAN, authorisations — **no** legal clearance |
| CDS Live | Production trader accounts — legally binding |

---

## Credentials and isolation

- Sandbox and production HMRC credentials are different sets. Do not reuse one set on the other host.
- Organisation Practice vs Live selects which set applies. Tokens belong to that organisation’s HMRC connection, not to “the whole production app.”
- Do not treat a production application deploy as permission to attach production HMRC credentials to every organisation.
- Deeper security behaviour: `docs/hmrc/ACTIVE/tdr/security/` and AGENT-SPEC operational rules.

---

## Agent rules

- Never infer HMRC CDS routing from FreightCode application deployment alone.
- Never infer FreightCode application production state from TDR usage.
- Never reuse HMRC credentials across sandbox and production hosts without explicit configuration for that host.
- Never move an organisation from Practice/TDR to CDS Live only because CDS Live is supported or configured.
- Never treat implementation capability, an env var name, or a production hostname as operational use.
- Read this file before changing HMRC hosts, Accept headers, OAuth hosts, or organisation HMRC mode.

---

## Unresolved operational state

Recorded here so agents do not invent answers:

- Whether HMRC has issued and validated FreightCode **production** Developer Hub credentials.
- Whether any organisation is **operationally** submitting to CDS Live.
- Whether per-organisation routing is in operational use for all tenants, or a deployment-wide `HMRC_ENVIRONMENT` still applies in some deploys ([`CUSTOMER-TDR-GUIDE.md`](./CUSTOMER-TDR-GUIDE.md) still states both the per-org model and a global-env limitation).
- Current CNS EUAT vs CNS live connection state — see `docs/cns/plan/`, not this file.
- Current MCP/Destin8 environment state.

---

## Historical (not current truth)

- Older text that said TDR runs on the production host, or that “production is future” for FreightCode the application, is **superseded** by this file and by `CLAUDE.md` / `README.md`.
- `docs/hmrc/FUTURE/production/` is HMRC production-host / credential cutover material.
- Trade Test v2.0 evidence is archive-only.
