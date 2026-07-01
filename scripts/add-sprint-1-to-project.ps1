# Adds refined Sprint 1 issues (#35-#64) to GitHub Project and sets Iteration: Sprint 1.
# Epic #9 stays in Backlog iteration (manual verify after run).
# Run from repo root: powershell -File scripts/add-sprint-1-to-project.ps1
# Override project: -ProjectNumber 2  OR  $env:GGL_PROJECT_NUMBER = "2"
# Requires: gh auth refresh -s read:project,project
param(
  [int]$ProjectNumber = 2,
  [switch]$IncludeOptionalLab,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
if (-not (Test-Path $gh)) { $gh = "gh" }
$owner = "gabrielagarayzavalia"
$repo = "$owner/GGZenLab-Portfolio"
# GitHub project title (exact or fuzzy match via Resolve-ProjectNumber)
$projectName = "GGZenLab QA Portfolio"
$projectNameAliases = @("GGZenLab Portfolio", "GGZenLab-Portfolio", "GGZenLab QA Portfolio")

# Core Sprint 1 (stories + tasks with label sprint-1)
$sprintIssues = 35..64
if ($IncludeOptionalLab) {
  $sprintIssues = 35..67
}

function Get-OwnerProjects {
  $json = & $gh project list --owner $owner --limit 50 --format json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "gh project list failed. Run: gh auth refresh -s read:project,project`n$json"
  }
  $parsed = $json | ConvertFrom-Json
  return @($parsed.projects)
}

function Resolve-ProjectNumber {
  param([int]$Num)
  if ($Num -gt 0) { return $Num }
  $envNum = $env:GGL_PROJECT_NUMBER
  if ($envNum -match '^\d+$') { return [int]$envNum }

  Write-Host "Resolving project number for '$projectName'..."
  $projects = Get-OwnerProjects

  $match = @($projects | Where-Object { $_.title -eq $projectName } | Select-Object -First 1)
  if (-not $match) {
    $aliases = @($projectName) + @($projectNameAliases | Where-Object { $_ -ne $projectName })
    foreach ($alias in $aliases) {
      $match = @($projects | Where-Object { $_.title -eq $alias } | Select-Object -First 1)
      if ($match) {
        Write-Host "Matched project by alias '$alias'."
        break
      }
    }
  }
  if (-not $match) {
    $match = @($projects | Where-Object {
        $_.title -match 'GGZenLab' -and $_.title -match 'Portfolio'
      } | Select-Object -First 1)
    if ($match) {
      Write-Host "Matched project by fuzzy title: '$($match.title)'."
    }
  }
  if (-not $match) {
    $available = ($projects | ForEach-Object { "#$($_.number) '$($_.title)'" }) -join "`n  "
    if (-not $available) { $available = "(none listed — check gh auth scopes)" }
    throw @"
Project '$projectName' not found for owner '$owner'.

Available projects:
  $available

Pass -ProjectNumber N or set `$env:GGL_PROJECT_NUMBER before running.
If gh project list fails, run: gh auth refresh -s read:project,project
"@
  }
  return [int]$match.number
}

function Resolve-Project {
  param([int]$Num)
  $projects = Get-OwnerProjects
  $num = Resolve-ProjectNumber -Num $Num
  $proj = @($projects | Where-Object { $_.number -eq $num } | Select-Object -First 1)
  if (-not $proj) { throw "Project #$num metadata not found for owner '$owner'" }
  return $proj
}

function Get-ProjectItems {
  param([int]$ProjNum)
  $json = & $gh project item-list $ProjNum --owner $owner --limit 500 --format json 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "gh project item-list failed.`n$json"
  }
  $parsed = $json | ConvertFrom-Json
  return @($parsed.items)
}

function Get-IterationField {
  param([int]$ProjNum)
  $query = @"
query {
  viewer {
    projectV2(number: $ProjNum) {
      fields(first: 30) {
        nodes {
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              iterations { id title startDate duration }
              completedIterations { id title startDate duration }
            }
          }
        }
      }
    }
  }
}
"@
  $json = & $gh api graphql -f query=$query 2>&1
  if ($LASTEXITCODE -ne 0) {
    throw "GraphQL iteration lookup failed. Run: gh auth refresh -s read:project,project`n$json"
  }
  $parsed = $json | ConvertFrom-Json
  $iter = @($parsed.data.viewer.projectV2.fields.nodes | Where-Object { $_.name -eq "Iteration" } | Select-Object -First 1)
  if (-not $iter) { throw "Iteration field not found on project #$ProjNum" }
  return $iter
}

function Get-Sprint1IterationId {
  param($IterationField)
  $all = @()
  if ($IterationField.configuration.iterations) {
    $all += @($IterationField.configuration.iterations)
  }
  if ($IterationField.configuration.completedIterations) {
    $all += @($IterationField.configuration.completedIterations)
  }
  $sprint1 = @($all | Where-Object { $_.title -eq "Sprint 1" } | Select-Object -First 1)
  if (-not $sprint1) {
    $titles = ($all | ForEach-Object { "'$($_.title)'" }) -join ", "
    if (-not $titles) { $titles = "(none configured)" }
    throw @"
Iteration 'Sprint 1' not found on project. Configured iterations: $titles

Create Sprint 1 in Project Settings -> Iterations, or run the GraphQL setup in scripts/README if documented.
"@
  }
  return $sprint1.id
}

$project = Resolve-Project -Num $ProjectNumber
$projNum = [int]$project.number
$projectId = $project.id
Write-Host "Project: $($project.title) (#$projNum)"

$iterField = Get-IterationField -ProjNum $projNum
$sprint1Id = Get-Sprint1IterationId -IterationField $iterField
Write-Host "Iteration field id: $($iterField.id) | Sprint 1 id: $sprint1Id"

$added = 0
$skipped = 0
$items = @()
if (-not $DryRun) {
  $items = Get-ProjectItems -ProjNum $projNum
}

foreach ($num in $sprintIssues) {
  $url = "https://github.com/$repo/issues/$num"
  if ($DryRun) {
    Write-Host "[dry-run] Would add #$num and set Sprint 1"
    continue
  }
  $item = @($items | Where-Object { $_.content.url -eq $url } | Select-Object -First 1)
  if (-not $item) {
    $addJson = & $gh project item-add $projNum --owner $owner --url $url --format json 2>&1
    if ($LASTEXITCODE -ne 0) { throw "gh project item-add failed for #$num`n$addJson" }
    $addedItem = $addJson | ConvertFrom-Json
    $item = [PSCustomObject]@{ id = $addedItem.id; content = [PSCustomObject]@{ url = $url } }
    Write-Host "Added to project: #$num"
    $added++
  } else {
    Write-Host "Already in project: #$num"
    $skipped++
  }
  if ($item) {
    & $gh project item-edit --project-id $projectId --id $item.id `
      --field-id $iterField.id --iteration-id $sprint1Id | Out-Null
    if ($LASTEXITCODE -ne 0) { throw "gh project item-edit failed for #$num" }
    Write-Host "  -> Iteration: Sprint 1"
  }
}

Write-Host "`n=== Sprint 1 project setup ==="
Write-Host "Added: $added | Already present: $skipped | Issues: $($sprintIssues[0])-$($sprintIssues[-1])"
Write-Host "Epic #9: keep Iteration = Backlog (verify manually in project UI)"
Write-Host "Board filter: iteration:@current + label:track:po"
Write-Host "WIP order: see projects/qa-job-hunter/SPRINT-1-PLAN.md"
