# Backfill GitHub Project field "Proyecto" from issue labels mini-project:*.
# Run from repo root: powershell -File scripts/backfill-proyecto-field.ps1
# Dry run: powershell -File scripts/backfill-proyecto-field.ps1 -DryRun
# Requires: gh auth with read:project,project scopes
param(
  [int]$ProjectNumber = 2,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$owner = "gabrielagarayzavalia"
$repo = "$owner/GGZenLab-Portfolio"

# Catalog: label suffix / full label -> Proyecto option name
$labelToProyecto = @{
  "mini-project:job-hunter"      = "job-hunter"
  "mini-project:mapa-corrupcion" = "mapa-corrupcion"
  "mini-project:api"             = "api-testing"
  "mini-project:perf"            = "performance"
  "mini-project:sql-lab"         = "sql-lab"
  "mini-project:labs"            = "labs"
  "mini-project:portfolio"       = "portfolio-skills"
}
$defaultProyecto = "portfolio-skills"

Write-Host "Resolving project #$ProjectNumber..."
$projectId = gh project list --owner $owner --limit 20 --format json |
  ConvertFrom-Json |
  Select-Object -ExpandProperty projects |
  Where-Object { $_.number -eq $ProjectNumber } |
  Select-Object -ExpandProperty id -First 1
if (-not $projectId) { throw "Project #$ProjectNumber not found for $owner" }

$fieldsJson = gh project field-list $ProjectNumber --owner $owner --format json | ConvertFrom-Json
$proyectoField = @($fieldsJson.fields | Where-Object { $_.name -eq "Proyecto" } | Select-Object -First 1)
if (-not $proyectoField) { throw "Field 'Proyecto' not found on project #$ProjectNumber. Create it first." }

$optionIdByName = @{}
foreach ($opt in $proyectoField.options) {
  $optionIdByName[$opt.name] = $opt.id
}
foreach ($needed in @($labelToProyecto.Values + $defaultProyecto | Select-Object -Unique)) {
  if (-not $optionIdByName.ContainsKey($needed)) {
    throw "Proyecto option '$needed' missing on field. Options: $($optionIdByName.Keys -join ', ')"
  }
}

Write-Host "Listing project items (may take a minute)..."
# Paginate via GraphQL for content + labels
$query = @'
query($id: ID!, $after: String) {
  node(id: $id) {
    ... on ProjectV2 {
      items(first: 50, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            ... on Issue {
              number
              title
              labels(first: 30) { nodes { name } }
            }
            ... on DraftIssue { title }
            ... on PullRequest { number title }
          }
          fieldValues(first: 30) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                field { ... on ProjectV2SingleSelectField { name } }
              }
            }
          }
        }
      }
    }
  }
}
'@

$items = @()
$after = $null
do {
  if ($after) {
    $page = gh api graphql -f query=$query -f id=$projectId -f after=$after | ConvertFrom-Json
  } else {
    $page = gh api graphql -f query=$query -f id=$projectId | ConvertFrom-Json
  }
  if ($page.errors) { throw ($page.errors | ConvertTo-Json -Depth 6) }
  $conn = $page.data.node.items
  $items += @($conn.nodes)
  $hasNext = [bool]$conn.pageInfo.hasNextPage
  $after = $conn.pageInfo.endCursor
} while ($hasNext)

Write-Host "Items loaded: $($items.Count)"

$stats = @{
  jobHunter   = 0
  portfolio   = 0
  other       = 0
  skippedSame = 0
  ambiguous   = @()
  errors      = @()
}

foreach ($item in $items) {
  $content = $item.content
  if (-not $content -or -not $content.number) {
    # Draft / non-issue → default portfolio-skills
    $target = $defaultProyecto
    $issueRef = "(draft/non-issue) $($content.title)"
    $labelNames = @()
  } else {
    $issueRef = "#$($content.number)"
    $labelNames = @($content.labels.nodes | ForEach-Object { $_.name })
    $matched = @()
    foreach ($lbl in $labelNames) {
      if ($labelToProyecto.ContainsKey($lbl)) { $matched += $labelToProyecto[$lbl] }
    }
    $matched = @($matched | Select-Object -Unique)
    if ($matched.Count -eq 0) {
      $target = $defaultProyecto
      $stats.ambiguous += "$issueRef no mini-project:* → $defaultProyecto | $($content.title)"
    } elseif ($matched.Count -gt 1) {
      $target = $matched[0]
      $stats.ambiguous += "$issueRef multiple mini-project labels ($($matched -join ',')) → $target | $($content.title)"
    } else {
      $target = $matched[0]
    }
  }

  $current = $null
  foreach ($fv in $item.fieldValues.nodes) {
    if ($fv.field.name -eq "Proyecto") { $current = $fv.name; break }
  }
  if ($current -eq $target) {
    $stats.skippedSame++
    continue
  }

  switch ($target) {
    "job-hunter" { $stats.jobHunter++ }
    "portfolio-skills" { $stats.portfolio++ }
    default { $stats.other++ }
  }

  $optionId = $optionIdByName[$target]
  Write-Host ("{0} → Proyecto={1}{2}" -f $issueRef, $target, $(if ($DryRun) { " (dry-run)" } else { "" }))

  if (-not $DryRun) {
    $out = gh project item-edit --id $item.id --project-id $projectId --field-id $proyectoField.id --single-select-option-id $optionId 2>&1
    if ($LASTEXITCODE -ne 0) {
      $stats.errors += "$issueRef failed: $out"
      Write-Warning $stats.errors[-1]
    }
  }
}

Write-Host ""
Write-Host "=== Summary ==="
Write-Host "Set job-hunter: $($stats.jobHunter)"
Write-Host "Set portfolio-skills: $($stats.portfolio)"
Write-Host "Set other: $($stats.other)"
Write-Host "Already correct (skipped): $($stats.skippedSame)"
Write-Host "Ambiguous / defaulted: $($stats.ambiguous.Count)"
if ($stats.ambiguous.Count -gt 0) {
  Write-Host "--- Ambiguous log ---"
  $stats.ambiguous | ForEach-Object { Write-Host $_ }
}
if ($stats.errors.Count -gt 0) {
  Write-Host "--- Errors ---"
  $stats.errors | ForEach-Object { Write-Host $_ }
  exit 1
}
Write-Host "Done."
