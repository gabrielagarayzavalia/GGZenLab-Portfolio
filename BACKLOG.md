# GGZenLab Portfolio — Skills Backlog

Portfolio monorepo: [gabrielagarayzavalia/GGZenLab-Portfolio](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio)  
Live site (EN default, bilingual): `https://gabrielagarayzavalia.github.io/GGZenLab-Portfolio/`  
Hub con dos subsitios: **QA** (`/qa/`) y **Product Owner** (`/product-owner/`).

## Published (Done)

| ID | Skill | Deliverables |
|----|-------|--------------|
| P-01 | API Testing | 3 SUTs, Gherkin, Postman, Rest-Assured, Playwright C#, Selenium, Senior report |
| P-02 | Performance | JMeter plan, Gherkin AC-PERF, manual + CLI, report |

## In progress

| ID | Skill | Goal | Practice on site |
|----|-------|------|------------------|
| B-01 | **Docker** | Deep-dive lab: images, compose, healthchecks, troubleshooting | [Practice Labs](docs/guides/index.html) Lab 1 |
| B-02 | **CI/CD — GitHub Actions** | Extend workflows: Newman, matrix all SUTs, badges | Lab 3 + `.github/workflows/` |
| B-05 | **Agile PM — GitHub Projects** | Board for epics, user stories, QA tasks; traceability to Gherkin AC | [Lab 4](docs/guides/index.html) + [setup guide](projects/agile/github-projects/README.md) |

## Planned

| ID | Skill | Goal | Accounts required |
|----|-------|------|-------------------|
| B-03 | **CI/CD — Azure DevOps** | Mirror pipelines (build SUTs, api-tests, Pages deploy) | **Azure** free account ([azure.microsoft.com](https://azure.microsoft.com/free/)) + **Azure DevOps** org ([dev.azure.com](https://dev.azure.com)) — DevOps basic tier is free, no credit card for pipelines on public repos |
| B-04 | **CI/CD — Jenkins** | `Jenkinsfile`, agent in Docker, same test stages | **No account** if Jenkins runs locally via `docker run jenkins/jenkins:lts`; optional CloudBees / other SaaS later |
### B-05 — Agile PM (tool chosen: **GitHub Projects**)

Other options considered: Jira, Trello, Azure Boards, Linear, Taiga.

### B-05 — Reference: other agile PM options

| Tool | Free tier | Best for GGZenLab |
|------|-----------|-------------------|
| **Jira** | Free up to 10 users ([atlassian.com](https://www.atlassian.com/software/jira/free)) | Industry standard; Epics → Stories → Tasks → Sub-tasks; links to AC/test cases |
| **Azure DevOps Boards** | Free with DevOps org (same as B-03) | Boards + backlogs + sprints if you already use Azure Pipelines |
| **GitHub Projects** | Free with GitHub | Native to this repo; issues as stories, no extra account |
| **Trello** | Free tier ([trello.com](https://trello.com)) | Kanban boards; lists as workflow states; cards as stories/tasks; labels for AC; Power-Ups for Gherkin links |
| **Linear** | Free for small teams | Lightweight agile UX |
| **Taiga** | Open source / cloud free tier | Self-host or SaaS; Scrum/Kanban |

**Deliverables (GitHub Projects):**

- [x] Issue templates: Epic, User Story, QA Task (`.github/ISSUE_TEMPLATE/`)
- [x] Seed issues doc: `projects/agile/github-projects/SEED_ISSUES.md`
- [ ] Project board **GGZenLab Portfolio** created on GitHub
- [ ] Epics + stories + sample tasks added; sprint simulation documented

## Account checklist

- [x] **GitHub** — `gabrielagarayzavalia` (repo + Actions + Pages)
- [ ] **Azure** — sign up for free tier when starting B-03
- [ ] **Azure DevOps** — create organization (e.g. `ggzenlab`) when starting B-03
- [ ] **Jenkins** — install via Docker only; no signup required for B-04
- [x] **Agile PM — GitHub Projects** (using `gabrielagarayzavalia`; create board after push)

## Conventions per mini-project

Each backlog item ships with:

1. Gherkin user story + acceptance criteria  
2. Manual test cases  
3. Automated tests (where applicable)  
4. Senior QA report + screenshots  
5. Bilingual subpage under `docs/`  
6. Practice lab section in `docs/guides/`

## Suggested order

1. Finish Docker lab content (B-01) — document compose, logs, rebuild  
2. Harden GitHub Actions (B-02) — PR gates, artifacts  
3. Azure DevOps parallel pipeline (B-03)  
4. Jenkins pipeline as code (B-04)  
5. **Now:** GitHub Projects (B-05) — create board, import [SEED_ISSUES.md](projects/agile/github-projects/SEED_ISSUES.md), run 1-week sprint practice
