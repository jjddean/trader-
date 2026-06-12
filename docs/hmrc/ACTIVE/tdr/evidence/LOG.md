# TDR v1 sandbox test log

Add one row per TDR test (`Accept: application/vnd.hmrc.1.0+xml`). Copy into evidence folders.

| Date (UTC) | Test | LRN | MRN | X-Conversation-ID | Outcome | Evidence |
|------------|------|-----|-----|-------------------|---------|----------|
| 2026-06-10 20:15 | Submit FC9 v1 | FC-MQ8IDIYS | 26GB6DTVT5133M7AR0 | c493713d-b599-421c-8283-f182a1e7d275 | DMSACC (CDS13000 advisory) | `submit/request.xml`, `submit/response-dmsacc.xml`, `passing-payload.xml` |

## Row template

```
| YYYY-MM-DD | <endpoint> | <LRN> | <MRN> | <conversation-id> | <DMS* / HTTP> | evidence/<folder>/ |
```
