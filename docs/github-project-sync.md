# GitHub Projects Sync (Fix Plan)

This workspace does not currently have `gh` CLI installed and no `GITHUB_TOKEN` is configured.

To push the same checklist structure to GitHub Projects, use the included script:

- `scripts/import-fix-plan-to-github-project.ps1`

## 1) Create a GitHub token
- Create a classic token (or fine-grained token) with project write access.
- Minimum required scopes typically include:
  - `project`
  - `read:org` (if project is org-owned)

## 2) Run import

```powershell
cd C:\Users\jason\trader-app
.\scripts\import-fix-plan-to-github-project.ps1 `
  -Owner "jjddean" `
  -ProjectNumber 1 `
  -GitHubToken "<YOUR_TOKEN>"
```

## 3) Expected output
- Resolves ProjectV2 by owner + project number.
- Adds six draft items mirroring `docs/app-flow-fix-plan.md`.
- Marks statuses in body as `Completed` for items 1-4 and `Pending` for items 5-6.

## 4) Verification checklist
- Open the target GitHub Project board.
- Confirm all 6 draft items exist.
- Confirm titles and status fields in body text match local docs.
