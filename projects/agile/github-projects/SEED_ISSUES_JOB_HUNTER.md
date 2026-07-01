# Seed issues — QA Job Hunter (Product Owner track)

Create via **Issues → New issue** using templates **Epic (Product Owner)**, **User Story (Product Owner)**, **PO Task**.  
Add to GitHub Project **GGZenLab Portfolio** · filter `track:po` or label `mini-project:job-hunter`.

Suggested labels (create in repo if missing):

| Label | Color hint | Use |
|-------|------------|-----|
| `track:po` | purple | All Product Owner issues |
| `track:qa` | blue | QA subsite issues |
| `mini-project:job-hunter` | green | QA Job Hunter |
| `backlog:B-06` … `backlog:B-16` | gray | Backlog ID |
| `priority:high` | red | B-06, B-13, B-07 |
| `status:done` | green | Shipped P-JH items |

---

## Epic — QA Job Hunter

**Title:** `[Epic] EPIC-JH — QA Job Hunter (Product Owner)`  
**Labels:** `epic`, `type:epic`, `track:po`, `mini-project:job-hunter`  
**Template:** Epic (Product Owner)

**Body:**
```
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
```

---

## Published stories (Done)

### P-JH-01 — LinkedIn scrape

**Title:** `[Story] US-JH-P01 — LinkedIn scrape and session`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `status:done`

```
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
```

### P-JH-02 — Match analysis

**Title:** `[Story] US-JH-P02 — LLM match analysis (Ollama + Claude)`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `status:done`

```
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
```

### P-JH-03 — Dashboard

**Title:** `[Story] US-JH-P03 — Web dashboard (list + detail)`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `status:done`

```
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
```

### P-JH-04 — Match feedback

**Title:** `[Story] US-JH-P04 — Incorrect match feedback`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `status:done`

```
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
```

---

## Backlog stories (Planned)

### B-06 — MongoDB

**Title:** `[Story] US-JH-B06 — MongoDB persistence and API`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-06`, `priority:high`

```
Story ID: US-JH-B06
Backlog ID: B-06
Parent Epic: EPIC-JH
Priority: high
Depends on: —

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
```

### B-13 — Multi-source (PRIORITY)

**Title:** `[Story] US-JH-B13 — Multi-source job adapters (PRIORITY)`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-13`, `priority:high`

```
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
```

### B-07 — Scheduled agent

**Title:** `[Story] US-JH-B07 — Scheduled agent 3×/day`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-07`, `priority:high`

```
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
- [ ] Log agent-runs.log; dashboard "New" filter/badge
```

### B-08 — Application tracking

**Title:** `[Story] US-JH-B08 — Application tracking in dashboard`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-08`

```
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
- [ ] "Mark as applied" button; status badges in list
- [ ] Filter tabs: All · New · Applied · In progress · Closed
```

### B-14 — Web site

**Title:** `[Story] US-JH-B14 — Web site home, run, and dashboard pages`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-14`

```
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
- [ ] /run: cards for Ollama / Claude / export (replaces A/B/C terminal)
- [ ] Live log or progress on /run
```

### B-15 — CV generator

**Title:** `[Story] US-JH-B15 — CV and cover letter generator`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-15`

```
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
- [ ] Suggest "Mark as applied" after generation
```

### B-09 — Generic app

**Title:** `[Story] US-JH-B09 — Generic multi-vertical profiles`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-09`

```
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
```

### B-10 — Monetization

**Title:** `[Story] US-JH-B10 — Monetization research`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-10`

```
Story ID: US-JH-B10
Backlog ID: B-10
Parent Epic: EPIC-JH
Priority: medium
Depends on: —

As product owner
I want a monetization research document
So that we decide go/no-go before building payments

AC:
- [ ] docs/monetization-research.md (freemium, SaaS, risks)
- [ ] LinkedIn ToS / scraping legal notes
- [ ] Cost model: Ollama local vs API vs cloud
- [ ] Competitor scan (Huntr, Teal, Jobscan)
- [ ] Recommendation matrix — no Stripe in this story
```

### B-12 — Multi-user OAuth

**Title:** `[Story] US-JH-B12 — Multi-user auth and LinkedIn accounts`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-12`

```
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
```

### B-16 — Cloud deploy

**Title:** `[Story] US-JH-B16 — Cloud deployment (Atlas + hosted app)`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-16`

```
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
- [ ] LLM_PROVIDER cloud defaults (anthropic/groq)
- [ ] Cron agent in cloud; HTTPS + healthchecks
- [ ] Practice lab in docs/guides/
```

### B-11 — Web3 PoC

**Title:** `[Story] US-JH-B11 — Web3 verifiable applications (exploratory)`  
**Labels:** `user-story`, `type:story`, `track:po`, `mini-project:job-hunter`, `backlog:B-11`, `priority:low`

```
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
- [ ] Dashboard "Register on-chain" after applied (testnet)
- [ ] Marked experimental — separate from daily flow
```

---

## Sample PO tasks (create 2–3 per active story)

| Title | Labels | Story | Type |
|-------|--------|-------|------|
| `[Task] JH-T-B06-01 — Docker Mongo service in compose` | `task`, `track:po`, `backlog:B-06` | US-JH-B06 | infrastructure |
| `[Task] JH-T-B06-02 — src/db repositories saveRun upsertJobs` | `task`, `track:po`, `backlog:B-06` | US-JH-B06 | implementation |
| `[Task] JH-T-B13-01 — B-13a ToS research per job board` | `task`, `track:po`, `backlog:B-13` | US-JH-B13 | research |
| `[Task] JH-T-B13-02 — JobSourceAdapter + LinkedInAdapter` | `task`, `track:po`, `backlog:B-13` | US-JH-B13 | implementation |
| `[Task] JH-T-B13-03 — GetOnBoardAdapter MVP` | `task`, `track:po`, `backlog:B-13` | US-JH-B13 | implementation |
| `[Task] JH-T-B13-04 — IndeedAdapter (AR) + scrape-orchestrator` | `task`, `track:po`, `backlog:B-13` | US-JH-B13 | implementation |
| `[Task] JH-T-B13-05 — Dashboard source badge and filter` | `task`, `track:po`, `backlog:B-13` | US-JH-B13 | ui-ux |
| `[Task] JH-T-B07-01 — scheduled-run.ts + npm run agent` | `task`, `track:po`, `backlog:B-07` | US-JH-B07 | implementation |
| `[Task] JH-T-B08-01 — PATCH /api/jobs/:id + timeline UI` | `task`, `track:po`, `backlog:B-08` | US-JH-B08 | ui-ux |
| `[Task] JH-T-B14-01 — home.html + run.html + shared nav` | `task`, `track:po`, `backlog:B-14` | US-JH-B14 | ui-ux |

**Task body template:**
```
Task ID: JH-T-B06-01
Backlog ID: B-06
Parent Story: US-JH-B06

Steps:
- Add mongo:7 to docker-compose.yml
- Document MONGODB_URI in README

DoD:
- [ ] Code merged or doc published
- [ ] Acceptance criteria of parent story met
```

---

## Import order

1. Create **EPIC-JH** epic → Iteration **Backlog** (never on sprint board)
2. Create **P-JH-01…P-JH-04** stories → mark **Done** or close
3. Create **B-06, B-13, B-07, B-08, B-14, B-15, B-09, B-10, B-12, B-16, B-11** stories → Iteration **Backlog**
4. Sprint planning: pull **US-JH-B06** + tasks first, then **US-JH-B13**
5. Link issues: Epic ↔ Stories via GitHub **Development** or project **Epic** field

---

## Quick link

**New issue:** https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/new/choose
