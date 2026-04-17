param(
  [Parameter(Mandatory = $true)]
  [string]$Owner,

  [Parameter(Mandatory = $true)]
  [int]$ProjectNumber,

  [Parameter(Mandatory = $true)]
  [string]$GitHubToken
)

$ErrorActionPreference = "Stop"

function Invoke-GitHubGraphQL {
  param(
    [string]$Query,
    [hashtable]$Variables
  )

  $body = @{
    query     = $Query
    variables = $Variables
  } | ConvertTo-Json -Depth 50

  $headers = @{
    Authorization = "Bearer $GitHubToken"
    "User-Agent"  = "trader-app-project-sync"
  }

  return Invoke-RestMethod -Method Post -Uri "https://api.github.com/graphql" -Headers $headers -Body $body -ContentType "application/json"
}

$getProjectQuery = @'
query($owner: String!, $number: Int!) {
  user(login: $owner) {
    projectV2(number: $number) {
      id
      title
    }
  }
  organization(login: $owner) {
    projectV2(number: $number) {
      id
      title
    }
  }
}
'@

$projectRes = Invoke-GitHubGraphQL -Query $getProjectQuery -Variables @{ owner = $Owner; number = $ProjectNumber }
$project = $null
if ($projectRes.data.user.projectV2) { $project = $projectRes.data.user.projectV2 }
if (-not $project -and $projectRes.data.organization.projectV2) { $project = $projectRes.data.organization.projectV2 }
if (-not $project) {
  throw "Could not resolve ProjectV2 for owner '$Owner' and number '$ProjectNumber'."
}

Write-Host "Resolved project: $($project.title) ($($project.id))"

$items = @(
  @{
    title = "1) Unify Submit Gate With Persisted Document Requirements"
    body  = @"
Severity: Critical
Estimated Effort: Medium (0.5-1 day)
Root Cause: Submit validation gates on per-item additionalDocuments while document_requirements is source of truth.
Corrective Actions:
- Read document_requirements in submit flow for active declaration.
- Block submit on missing blocking requirements.
- Show missing requirement codes pre-flight.
- Hydrate shipment rules in submit flow.
Success Criteria:
- Submit disabled when required blocking docs missing.
- Missing requirement codes visible before submit.
- Submit and documents pages agree on pass/fail.
Status: Completed
"@
  }
  @{
    title = "2) Retire Legacy Declaration-Scoped Documents Flow"
    body  = @"
Severity: Critical
Estimated Effort: Small-Medium (0.5 day)
Root Cause: Two parallel document flows caused divergence and duplicate logic.
Corrective Actions:
- Redirect /dashboard/declarations/[id]/documents -> /dashboard/documents?declaration=<id>.
- Preselect declaration in unified docs page.
- Ensure side-effect-free behavior.
Success Criteria:
- Old route lands in unified flow with declaration context.
- Legacy isolated upload path is no longer in use.
Status: Completed
"@
  }
  @{
    title = "3) Define Blocking vs Advisory Rules"
    body  = @"
Severity: High
Estimated Effort: Medium (1 day)
Root Cause: Requirements did not distinguish legal blockers from advisory evidence.
Corrective Actions:
- Add requirementLevel (blocking/advisory).
- Submit gate blocks only on missing blocking requirements.
- Advisory gaps shown as warnings.
Success Criteria:
- Submit blocked only on blocking items.
- UI distinguishes advisory from blocking.
Status: Completed
"@
  }
  @{
    title = "4) HMRC Mapping Alignment for DE 2/3 and Origin Evidence"
    body  = @"
Severity: High
Estimated Effort: Medium-Large (1-2 days)
Root Cause: Scenario rules were not fully mapped to DE 2/3 and agreement-aware origin evidence.
Corrective Actions:
- Add DE 2/3 metadata and HMRC guidance per requirement.
- Add agreement-aware advisory evidence (U166/U164/U101/N864/N865 context).
- Use shared HMRC requirement set in submit + documents hydration.
Success Criteria:
- Scenario matrix documented and implemented.
- Requirement metadata persisted and visible in flow.
Status: Completed
"@
  }
  @{
    title = "5) Reports/Records Truthfulness Guardrails"
    body  = @"
Severity: Medium
Estimated Effort: Medium (1 day)
Root Cause: Derived/placeholder values can be misread as authoritative HMRC truth.
Corrective Actions:
- Label derived/demo values explicitly.
- Add provenance metadata (derived vs hmrc_confirmed).
- Prevent misleading exports.
Success Criteria:
- Users can distinguish estimated vs confirmed.
- Exports do not overstate finality.
Status: Pending
"@
  }
  @{
    title = "6) End-to-End Regression Suite for Customs Flow"
    body  = @"
Severity: Medium
Estimated Effort: Medium (1 day)
Root Cause: Cross-flow changes risk silent regressions without E2E checks.
Corrective Actions:
- Add smoke/E2E checks for upload/paste/replace/delete/generate/submit.
- Verify auth ownership checks.
- Verify requirement transitions (missing -> uploaded -> missing).
Success Criteria:
- Test run passes before release.
- Core customs flow is reproducible and stable.
Status: Pending
"@
  }
)

$addDraftMutation = @'
mutation($projectId: ID!, $title: String!, $body: String!) {
  addProjectV2DraftIssue(input: { projectId: $projectId, title: $title, body: $body }) {
    projectItem {
      id
    }
  }
}
'@

foreach ($item in $items) {
  Write-Host "Adding draft item: $($item.title)"
  $null = Invoke-GitHubGraphQL -Query $addDraftMutation -Variables @{
    projectId = $project.id
    title     = $item.title
    body      = $item.body
  }
}

Write-Host "Done. Added $($items.Count) checklist items to GitHub Project '$($project.title)'."
