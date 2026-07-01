# Creates QA Job Hunter PO backlog issues on GitHub (idempotent-ish: skips if title exists)
$ErrorActionPreference = "Stop"
$gh = "C:\Program Files\GitHub CLI\gh.exe"
$repo = "gabrielagarayzavalia/GGZenLab-Portfolio"
$tmp = Join-Path $env:TEMP "gh-jh-issues"
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

function Ensure-Label($name, $color, $desc) {
  $list = & $gh label list --repo $repo --limit 200 --json name --jq ".[].name" 2>$null
  if ($list -notcontains $name) {
    & $gh label create $name --repo $repo --color $color --description $desc 2>$null
    Write-Host "Label: $name"
  }
}

function Issue-Exists($title) {
  $issues = & $gh issue list --repo $repo --state all --limit 200 --json title 2>$null | ConvertFrom-Json
  if (-not $issues) { return $false }
  return @($issues | Where-Object { $_.title -eq $title }).Count -gt 0
}

function New-GhIssue($title, $body, $labels, [switch]$Close) {
  if (Issue-Exists $title) {
    Write-Host "SKIP (exists): $title"
    return $null
  }
  $bodyFile = Join-Path $tmp ([Guid]::NewGuid().ToString() + ".md")
  Set-Content -Path $bodyFile -Value $body -Encoding UTF8
  $labelArgs = $labels | ForEach-Object { "--label"; $_ }
  $url = & $gh issue create --repo $repo --title $title --body-file $bodyFile @labelArgs
  Remove-Item $bodyFile -Force -ErrorAction SilentlyContinue
  Write-Host "Created: $title -> $url"
  if ($Close -and $url) {
    $num = ($url -split '/')[-1]
    & $gh issue close $num --repo $repo --comment "Shipped — tracked as done in backlog seed." | Out-Null
    Write-Host "  Closed #$num"
  }
  return $url
}

# Labels
Ensure-Label "epic" "1D76DB" "Agile epic"
Ensure-Label "type:epic" "1D76DB" "Issue type epic"
Ensure-Label "user-story" "0075CA" "User story"
Ensure-Label "type:story" "0075CA" "Issue type story"
Ensure-Label "task" "FBCA04" "Task"
Ensure-Label "type:task" "FBCA04" "Issue type task"
Ensure-Label "track:po" "5319E7" "Product Owner track"
Ensure-Label "mini-project:job-hunter" "0E8A16" "QA Job Hunter product"
Ensure-Label "status:done" "2DA44E" "Shipped"
Ensure-Label "priority:high" "B60205" "High priority"
Ensure-Label "priority:low" "C5DEF5" "Low priority"
foreach ($id in @("B-06","B-07","B-08","B-09","B-10","B-11","B-12","B-13","B-14","B-15","B-16")) {
  Ensure-Label "backlog:$id" "D4C5F9" "Backlog $id"
}

# Epic
New-GhIssue "[Epic] EPIC-JH — QA Job Hunter (Product Owner)" @"
Epic ID: EPIC-JH
Goal: Agentic job search for QA roles — scrape, LLM match, dashboard, application tracking, multi-source roadmap
Repo: projects/qa-job-hunter/
Site: docs/product-owner/job-hunter.html

Deliverables:
- [x] P-JH-01 LinkedIn scrape + session
- [x] P-JH-02 Ollama / Claude match analysis
- [x] P-JH-03 Web dashboard (JSON)
- [x] P-JH-04 Incorrect-match feedback loop
- [ ] B-06 MongoDB persistence
- [ ] B-13 Multi-source jobs (PRIORITY)
- [ ] B-07 Scheduled agent 3×/day
- [ ] B-08 Application tracking
- [ ] B-14 Web site (home + run + dashboard)
- [ ] B-15 CV + cover letter generator
- [ ] B-09 Generic multi-vertical profiles
- [ ] B-10 Monetization research
- [ ] B-12 Multi-user OAuth
- [ ] B-16 Cloud deployment
- [ ] B-11 Web3 PoC (exploratory)
"@ @("epic","type:epic","track:po","mini-project:job-hunter")

# Done stories
New-GhIssue "[Story] US-JH-P01 — LinkedIn scrape and session" @"
Story ID: US-JH-P01
Backlog ID: P-JH-01
Parent Epic: EPIC-JH
Priority: done

As a job seeker
I want LinkedIn jobs scraped with a reusable session
So that I do not log in manually every run

AC:
- [x] Playwright login saves session to session/
- [x] 2-scrape-jobs.ts searches configured terms
- [x] Output jobs-result-raw.json
"@ @("user-story","type:story","track:po","mini-project:job-hunter","status:done") -Close

New-GhIssue "[Story] US-JH-P02 — LLM match analysis (Ollama + Claude)" @"
Story ID: US-JH-P02
Backlog ID: P-JH-02
Parent Epic: EPIC-JH
Priority: done

As a job seeker
I want each job scored against my profile
So that I focus on roles with 70%+ match

AC:
- [x] llm-client.ts supports ollama and anthropic
- [x] 3-analyze-match.ts produces jobs-result.json
- [x] Match percent, skills, gaps, cvSuggestions, summary
"@ @("user-story","type:story","track:po","mini-project:job-hunter","status:done") -Close

New-GhIssue "[Story] US-JH-P03 — Web dashboard (list + detail)" @"
Story ID: US-JH-P03
Backlog ID: P-JH-03
Parent Epic: EPIC-JH
Priority: done

As a job seeker
I want a browser dashboard sorted by match %
So that I review offers without reading JSON files

AC:
- [x] npm run dashboard on port 3847
- [x] GET /api/results reads output/jobs-result.json
- [x] Sort matchPercent asc/desc; detail panel with full analysis
"@ @("user-story","type:story","track:po","mini-project:job-hunter","status:done") -Close

New-GhIssue "[Story] US-JH-P04 — Incorrect match feedback" @"
Story ID: US-JH-P04
Backlog ID: P-JH-04
Parent Epic: EPIC-JH
Priority: done

As a job seeker
I want to reject wrong matches with optional reason
So that future analyses learn from my corrections

AC:
- [x] POST /api/feedback/reject persists match-feedback.json
- [x] 3-analyze-match skips rejected jobs
- [x] Prompt includes learning block from feedback
"@ @("user-story","type:story","track:po","mini-project:job-hunter","status:done") -Close

# Planned stories
$stories = @(
  @{
    Title = "[Story] US-JH-B06 — MongoDB persistence and API"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-06","priority:high")
    Body = @"
Story ID: US-JH-B06
Backlog ID: B-06
Parent Epic: EPIC-JH
Priority: high

As a job seeker
I want jobs and analysis runs stored in MongoDB
So that I keep history and query without overwriting JSON

AC:
- [ ] mongo:7 in docker-compose; MONGODB_URI documented
- [ ] Collections analysis_runs, jobs, skipped_jobs
- [ ] Pipeline upserts after analyze; dedup by url/id
- [ ] GET /api/jobs?sort=matchPercent&order=desc
- [ ] npm run db:seed from jobs-result.json
- [ ] Lab QA: Gherkin + API tests + docs subpage
"@
  },
  @{
    Title = "[Story] US-JH-B13 — Multi-source job adapters (PRIORITY)"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-13","priority:high")
    Body = @"
Story ID: US-JH-B13
Backlog ID: B-13
Parent Epic: EPIC-JH
Priority: high-priority
Depends on: B-06

As a job seeker
I want jobs from LinkedIn, GetOnBoard, and Indeed in one list
So that I do not miss offers outside LinkedIn

AC:
- [ ] JobSourceAdapter interface + LinkedInAdapter refactor
- [ ] GetOnBoardAdapter + IndeedAdapter (AR) MVP
- [ ] scrape-orchestrator.ts in run-all pipeline
- [ ] JobListing.source + externalId; dedup per source
- [ ] Dashboard source badge + filter by site
- [ ] B-13a research doc: ToS, rate limits per source
"@
  },
  @{
    Title = "[Story] US-JH-B07 — Scheduled agent 3×/day"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-07","priority:high")
    Body = @"
Story ID: US-JH-B07
Backlog ID: B-07
Parent Epic: EPIC-JH
Priority: high
Depends on: B-06, B-13

As a job seeker
I want automatic scrape+analyze 3 times per day
So that new jobs appear without manual runs

AC:
- [ ] scheduled-run.ts headless (no prompts)
- [ ] Configurable schedule (08:00, 14:00, 20:00)
- [ ] npm run agent + Task Scheduler docs (Windows)
- [ ] New jobs: firstSeenAt; dedup upsert
- [ ] Log agent-runs.log; dashboard New filter/badge
"@
  },
  @{
    Title = "[Story] US-JH-B08 — Application tracking in dashboard"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-08")
    Body = @"
Story ID: US-JH-B08
Backlog ID: B-08
Parent Epic: EPIC-JH
Priority: medium
Depends on: B-06

As a job seeker
I want to track application status and interview dates
So that I manage my pipeline after applying

AC:
- [ ] applicationStatus enum (new → applied → … → closed)
- [ ] timeline fields + technicalInterviews[] (multiple rounds)
- [ ] PATCH /api/jobs/:id from dashboard
- [ ] Mark as applied button; status badges in list
- [ ] Filter tabs: All · New · Applied · In progress · Closed
"@
  },
  @{
    Title = "[Story] US-JH-B14 — Web site home, run, and dashboard pages"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-14")
    Body = @"
Story ID: US-JH-B14
Backlog ID: B-14
Parent Epic: EPIC-JH
Priority: medium
Depends on: P-JH-03

As a job seeker
I want to run the pipeline from the browser without terminal
So that the product feels like a complete web app

AC:
- [ ] Routes /, /run, /dashboard (+ /cv stub)
- [ ] Shared nav; home shows last run summary
- [ ] POST /api/run/scrape|analyze; GET /api/status
- [ ] /run: cards for Ollama / Claude / export
- [ ] Live log or progress on /run
"@
  },
  @{
    Title = "[Story] US-JH-B15 — CV and cover letter generator"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-15")
    Body = @"
Story ID: US-JH-B15
Backlog ID: B-15
Parent Epic: EPIC-JH
Priority: medium
Depends on: B-14, P-JH-02

As a job seeker
I want a tailored CV and cover letter per job
So that I apply faster with ATS-friendly text

AC:
- [ ] Upload CV (PDF/DOCX/TXT) → extracted text
- [ ] POST /api/cv/generate modes: ollama | anthropic | claude_ai_share
- [ ] Output cv.md + cover-letter.md per jobId
- [ ] UI in job detail + /cv workshop page
- [ ] Suggest Mark as applied after generation
"@
  },
  @{
    Title = "[Story] US-JH-B09 — Generic multi-vertical profiles"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-09")
    Body = @"
Story ID: US-JH-B09
Backlog ID: B-09
Parent Epic: EPIC-JH
Priority: medium
Depends on: B-06, B-08

As any job seeker
I want configurable search profiles beyond QA
So that the tool works for other roles and verticals

AC:
- [ ] search_profiles collection (terms, profileText, filters)
- [ ] Profile selector in dashboard; seed qa-senior default
- [ ] Parametrized buildMatchPrompt()
- [ ] Agent runs per enabled profile
- [ ] Import/export profiles JSON
"@
  },
  @{
    Title = "[Story] US-JH-B10 — Monetization research"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-10")
    Body = @"
Story ID: US-JH-B10
Backlog ID: B-10
Parent Epic: EPIC-JH
Priority: medium

As product owner
I want a monetization research document
So that we decide go/no-go before building payments

AC:
- [ ] docs/monetization-research.md
- [ ] LinkedIn ToS / scraping legal notes
- [ ] Cost model: Ollama local vs API vs cloud
- [ ] Competitor scan (Huntr, Teal, Jobscan)
- [ ] Recommendation matrix — no Stripe in this story
"@
  },
  @{
    Title = "[Story] US-JH-B12 — Multi-user auth and LinkedIn accounts"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-12")
    Body = @"
Story ID: US-JH-B12
Backlog ID: B-12
Parent Epic: EPIC-JH
Priority: medium
Depends on: B-06, B-09, B-10

As a registered user
I want to log in with Google/LinkedIn/Facebook and link LinkedIn for scrape
So that my data is isolated from other users

AC:
- [ ] users + linkedin_accounts collections
- [ ] OAuth app login (Auth.js or Passport)
- [ ] N LinkedIn accounts per user; active account selector
- [ ] Encrypted session storage; user A cannot see user B jobs
- [ ] B-12a research: OAuth scopes, 2FA, ToS
"@
  },
  @{
    Title = "[Story] US-JH-B16 — Cloud deployment (Atlas + hosted app)"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-16")
    Body = @"
Story ID: US-JH-B16
Backlog ID: B-16
Parent Epic: EPIC-JH
Priority: medium
Depends on: B-06, B-10, B-12

As a cloud user
I want Job Hunter hosted without my local PC
So that the agent and dashboard run 24/7

AC:
- [ ] B-16a provider comparison + cost doc
- [ ] MongoDB Atlas + MONGODB_URI staging/prod
- [ ] Dockerfile + deploy Railway/Render/Fly
- [ ] LLM_PROVIDER cloud defaults
- [ ] Cron agent in cloud; HTTPS + healthchecks
- [ ] Practice lab in docs/guides/
"@
  },
  @{
    Title = "[Story] US-JH-B11 — Web3 verifiable applications (exploratory)"
    Labels = @("user-story","type:story","track:po","mini-project:job-hunter","backlog:B-11","priority:low")
    Body = @"
Story ID: US-JH-B11
Backlog ID: B-11
Parent Epic: EPIC-JH
Priority: low
Depends on: B-09, B-10

As product owner exploring Web3
I want a testnet PoC for verifiable application receipts
So that the portfolio demonstrates Solidity + Rust integration

AC:
- [ ] B-11a research: utility vs gimmick, no PII on-chain
- [ ] ApplicationRegistry.sol + Foundry tests
- [ ] Rust event indexer → Mongo sync
- [ ] Dashboard Register on-chain after applied (testnet)
- [ ] Marked experimental — separate from daily flow
"@
  }
)

foreach ($s in $stories) {
  New-GhIssue $s.Title $s.Body $s.Labels | Out-Null
}

# Sample tasks
$tasks = @(
  @{ Title = "[Task] JH-T-B06-01 — Docker Mongo service in compose"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-06"); Body = "Task ID: JH-T-B06-01`nBacklog ID: B-06`nParent Story: US-JH-B06`n`nSteps:`n- Add mongo:7 to docker-compose.yml`n- Document MONGODB_URI in README" },
  @{ Title = "[Task] JH-T-B06-02 — src/db repositories saveRun upsertJobs"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-06"); Body = "Task ID: JH-T-B06-02`nBacklog ID: B-06`nParent Story: US-JH-B06`n`nSteps:`n- src/db connection + saveRun, upsertJobs, getLatestRun, listJobs" },
  @{ Title = "[Task] JH-T-B13-01 — B-13a ToS research per job board"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-13"); Body = "Task ID: JH-T-B13-01`nBacklog ID: B-13`nParent Story: US-JH-B13`n`nSteps:`n- Document ToS, rate limits, API vs scrape for LinkedIn, GetOnBoard, Indeed" },
  @{ Title = "[Task] JH-T-B13-02 — JobSourceAdapter + LinkedInAdapter"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-13"); Body = "Task ID: JH-T-B13-02`nBacklog ID: B-13`nParent Story: US-JH-B13`n`nSteps:`n- Define JobSourceAdapter interface`n- Refactor 2-scrape-jobs.ts to LinkedInAdapter" },
  @{ Title = "[Task] JH-T-B13-03 — GetOnBoardAdapter MVP"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-13"); Body = "Task ID: JH-T-B13-03`nBacklog ID: B-13`nParent Story: US-JH-B13`n`nSteps:`n- Implement GetOnBoardAdapter search()`n- Normalize to JobListing" },
  @{ Title = "[Task] JH-T-B13-04 — IndeedAdapter (AR) + scrape-orchestrator"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-13"); Body = "Task ID: JH-T-B13-04`nBacklog ID: B-13`nParent Story: US-JH-B13`n`nSteps:`n- IndeedAdapter (region AR)`n- scrape-orchestrator.ts + wire run-all.ts`n- Dedup source + externalId via Mongo" },
  @{ Title = "[Task] JH-T-B13-05 — Dashboard source badge and filter"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-13"); Body = "Task ID: JH-T-B13-05`nBacklog ID: B-13`nParent Story: US-JH-B13`n`nSteps:`n- Source badge in list + detail`n- Filter by source; GET /api/jobs?source=" },
  @{ Title = "[Task] JH-T-B07-01 — scheduled-run.ts + npm run agent"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-07"); Body = "Task ID: JH-T-B07-01`nBacklog ID: B-07`nParent Story: US-JH-B07`n`nSteps:`n- Headless orchestrator from run-all.ts`n- npm run agent + Task Scheduler docs" },
  @{ Title = "[Task] JH-T-B08-01 — PATCH /api/jobs/:id + timeline UI"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-08"); Body = "Task ID: JH-T-B08-01`nBacklog ID: B-08`nParent Story: US-JH-B08`n`nSteps:`n- PATCH endpoint + dashboard tracking UI`n- technicalInterviews[] editor" },
  @{ Title = "[Task] JH-T-B14-01 — home.html + run.html + shared nav"; Labels = @("task","type:task","track:po","mini-project:job-hunter","backlog:B-14"); Body = "Task ID: JH-T-B14-01`nBacklog ID: B-14`nParent Story: US-JH-B14`n`nSteps:`n- Multi-page site structure`n- POST /api/run/* endpoints" }
)

foreach ($t in $tasks) {
  New-GhIssue $t.Title $t.Body $t.Labels | Out-Null
}

Write-Host "`nDone. List:"
& $gh issue list --repo $repo --label "track:po" --limit 30
