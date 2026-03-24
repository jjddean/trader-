# Recent Code Updates (Last 5 Major Commits)

Here are the raw code updates and file diffs for your last 5 changes based on your repository's history, as requested.

### 1. Current Work - HMRC Fraud Prevention Headers (Uncommitted)
**Files Refactored:**
- `src/app/api/hmrc/submit/route.ts`
- `src/app/api/hmrc/amend/route.ts`
- `src/app/api/hmrc/cancel/route.ts`
- `src/app/api/hmrc/documents/initiate/route.ts`
- `src/app/api/hmrc/upload/route.ts`
- `src/lib/hmrc-fetch.ts` (New)
- `src/lib/hmrc-fraud-headers.ts` (New)

---

### 2. Commit 0f9f432 - TDR Readiness Scaffolding & API Endpoints
**Files Modified:** `15 files changed, 1733 insertions(+), 63 deletions(-)`
```text
 documentation/admin-guide.md                 | 248 ++++++++++++
 documentation/runbook.md                     |  97 +++++
 scripts/tdr-readiness-test.js                | 563 +++++++++++++++++++++++++++
 src/app/api/health/route.ts                  |  19 +
 src/app/api/hmrc/amend/route.ts              | 127 ++++++
 src/app/api/hmrc/cancel/route.ts             | 106 +++++
 src/app/api/hmrc/notifications/pull/route.ts | 135 +++++++
 src/app/api/hmrc/status-query/route.ts       |  74 ++++
 src/app/api/hmrc/submit/route.ts             |  91 +++--
 src/app/auth/hmrc/callback/route.ts          |   5 +-
 src/lib/rate-limiter.ts                      |  39 ++
 src/lib/wco-mapper.ts                        |  17 +-
 src/lib/xml-utils.ts                         |  18 +
 task.md                                      |  58 ++-
 test-evidence/tdr-readiness-results.json     | 199 ++++++++++
```

---

### 3. Commit 57a1ad1 - HS Code Lookup Tool Implementation
**Files Modified:** `14 files changed, 254 insertions(+), 14 deletions(-)`
```text
 convex/_generated/api.d.ts                     |   2 +
 convex/hmrc_actions.ts                         |  42 +++++++
 package-lock.json                              |  11 ++
 package.json                                   |   1 +
 src/app/dashboard/layout.tsx                   |   1 +
 src/app/dashboard/support/page.tsx             |   4 +-
 src/app/dashboard/tools/hscode-lookup/page.tsx |  24 ++++
 src/app/globals.css                            |   5 +
 src/app/page.tsx                               |  14 +--
 src/app/solutions/page.tsx                     |   2 +-
 src/components/app-sidebar.tsx                 |   2 +
 src/components/site-header.tsx                 |   4 +-
 src/components/tools/HSCodeLookup.tsx          | 151 +++++++++++++++++++++++++
 src/components/waitlist-form.tsx               |   5 +-
```

---

### 4. Commit e185f28 - Test Evidence and XML Scenarios
**Files Modified:** `7 files changed, 199 insertions(+), 15 deletions(-)`
```text
 src/app/page.tsx                                   |  8 --
 test-evidence/run-hmrc-scenarios.js                | 14 ++--
 test-evidence/scenario-1-post-connect-request.xml  | 91 ++++++++++++++++++++++
 test-evidence/scenario-1-post-connect-response.xml |  3 +
 test-evidence/scenario-1-retry2-request.xml        | 91 ++++++++++++++++++++++
 test-evidence/scenario-1-retry2-response.xml       |  3 +
 test-evidence/scenario-summary.json                |  4 +-
```

---

### 5. Commits 46d1f42 & d08b918 - Homepage Text Refactoring
**Files Modified:** `1 file changed, 13 insertions(+), 13 deletions(-)`
```text
 src/app/page.tsx | 26 ++++++------
```
