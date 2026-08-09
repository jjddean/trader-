# Remaining CNS Plan

## 1. CDS error display — Complete

- Parse `StatementDescription`.
- Show the real CDS message instead of duplicate `CDS13000`.
- Test with the stored response.

## 2. Clean CDS acceptance — In progress

- Create one new declaration using an unused UCN.
- Use realistic value, weight and supplementary units.
- Confirm CNS passes it and CDS returns acceptance without `DMSINV`.

## 3. Amendment test — Pending

- Amend the accepted declaration through CNS.
- Confirm the original LRN is reused.
- Confirm the amendment response appears correctly.

## 4. Cancellation test — Pending

- Cancel through CNS.
- Confirm CNS and CDS responses are stored and displayed.

## 5. Reliability check — Pending

- Test polling, replay, duplicate notifications and failures.
- Confirm no messages are lost and status never remains incorrectly pending.

## 6. Production readiness — Pending

- Add production CNS configuration separately.
- Keep EUAT and production credentials isolated.
- Run production preflight without submitting live data.
