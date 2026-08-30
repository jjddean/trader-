# ICO self-assessment — policy mapping

**Product:** Freightcode · **Last updated:** 2026-06-15  
**Source policy:** [`documentation/R_and_D/information_security_policy.md`](../../../../../documentation/R_and_D/information_security_policy.md)  
**Ops summary:** [`OPS-SECURITY.md`](./OPS-SECURITY.md)

Mapping to the [ICO security outcomes](https://ico.org.uk/for-organisations/advice-for-small-organisations/create-your-own-security-outcomes/) checklist themes.

| ICO theme | Freightcode control | Evidence |
|-----------|---------------------|----------|
| **1. Senior accountability** | Engineering owner; ops docs in `security/` | [`OPS-SECURITY.md`](./OPS-SECURITY.md), [`OPS-BACKUP-DR.md`](./OPS-BACKUP-DR.md) |
| **2. Risk management** | Security review + remediation log + pen-test checklist | [`SECURITY-REVIEW.md`](./SECURITY-REVIEW.md), [`REMEDIATION-LOG.md`](./REMEDIATION-LOG.md), [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) |
| **3. Asset management** | Declarations, notifications, tokens in Convex; reference data in R2 | [`OPS-BACKUP-DR.md`](./OPS-BACKUP-DR.md) § Data classification |
| **4. Data protection** | TLS in transit; Convex AES-256 at rest; secrets in Vercel/Convex env | Policy §2; no secrets in git |
| **5. Secure configuration** | Auth on mutations; webhook secrets; no default fallbacks in `http.ts` | [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) §3–4 |
| **6. User access control** | Clerk auth; Convex `getUserIdentity()`; ownership checks | [`OPS-SECURITY.md`](./OPS-SECURITY.md) § Access control |
| **7. Malware / service abuse** | AI routes auth + rate limits; upload size caps | [`OPS-SECURITY.md`](./OPS-SECURITY.md) § AI routes |
| **8. Monitoring & logging** | Audit mutations; HMRC webhook metadata-only logs in production | Policy §6; `convex/audit.ts` |
| **9. Incident response** | 5-step summary in backup/DR one-pager | [`OPS-BACKUP-DR.md`](./OPS-BACKUP-DR.md) § Incident response |
| **10. Supplier / third party** | Clerk, Stripe, Convex, Vercel — vendor SLAs; OAuth tokens server-side in submit routes | Policy §3 |
| **11. Privacy notices** | Public privacy + terms | https://www.freightcode.co.uk/privacy · `/terms` |
| **12. Training & awareness** | Internal policy for engineering; HMRC behaviour in AGENT-SPEC | [`AGENT-SPEC.md`](../AGENT-SPEC.md) |

**Gaps (accepted / planned):**

- Full org RBAC (workspace sharing) — [`BACKLOG.md`](../BACKLOG.md)
- Independent third-party pen test — [`PEN-TEST-CHECKLIST.md`](./PEN-TEST-CHECKLIST.md) §9 (booked by product owner)
- `waitlist.join` — intentional public endpoint; rate limit if abused
