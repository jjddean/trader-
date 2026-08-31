# TDR access request (draft for SDST)

**Status:** ARCHIVED — history only. Do not send this request as a current instruction.

TDR on the sandbox host is already an approved HMRC CDS path. See [`../ACTIVE/tdr/environment-matrix.md`](../ACTIVE/tdr/environment-matrix.md).

**When:** After `docs/hmrc/ARCHIVE/trade-test/pre-tdr-checklist.md` notification + API rows are complete in Trade Test.

**Email:** SDSTeam@HMRC.gov.uk (optional: TDRcommunications@hmrc.gov.uk for distribution list)

**Attach / link:**

- `docs/hmrc/ARCHIVE/trade-test/evidence/tt-evidence-pack/README.md` index
- `docs/hmrc/ARCHIVE/trade-test/passing-payload.xml` or HMRC conversation ID for FC-MPYAJ7RN
- Developer Hub application ID (sandbox + requested TDR app)

**Confirm with SDST before coding TDR:**

- API versions (Runbook slide 10 lists Declarations **1.0** + Pull Notifications **1.0** for TDR vs TT **2.0**)
- Whether v2.0 Trade Test proof satisfies Pre-TDR without v1 TDR parity

**Do not use TDR for:** performance testing, discovering basic XML mapping errors (Runbook slides 9, 24).
