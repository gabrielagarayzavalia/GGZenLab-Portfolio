# GGZenLab Portfolio — Backlog index

Portfolio monorepo: [gabrielagarayzavalia/GGZenLab-Portfolio](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio)  
Live site: `https://gabrielagarayzavalia.github.io/GGZenLab-Portfolio/`  
GitHub Project: [GGZenLab QA Portfolio](https://github.com/users/gabrielagarayzavalia/projects/2)

Este archivo es el **índice** del backlog multi-proyecto. El detalle operativo vive en el board (campo **Proyecto**) y, cuando existe, en el `BACKLOG.md` del subproyecto.

## Catálogo Proyecto ↔ label

| Proyecto (board) | Label | Carpeta / alcance | Markdown local |
|------------------|-------|-------------------|----------------|
| `job-hunter` | `mini-project:job-hunter` | `projects/qa-job-hunter` | [BACKLOG.md](projects/qa-job-hunter/BACKLOG.md) · [REFINED](projects/qa-job-hunter/BACKLOG-REFINED.md) |
| `mapa-corrupcion` | `mini-project:mapa-corrupcion` | `projects/mapa-corrupcion-tierras` | — |
| `api-testing` | `mini-project:api` | `projects/api-testing` | — |
| `performance` | `mini-project:perf` | `projects/performance-jmeter` | — |
| `sql-lab` | `mini-project:sql-lab` | `projects/sql-lab` | — |
| `labs` | `mini-project:labs` | `projects/labs` | — |
| `portfolio-skills` | `mini-project:portfolio` | Skills B-01…B-05, site, agile, docs monorepo | (este índice + board) |

**Contrato:** todo issue nuevo exige **Proyecto** (field del board) + label `mini-project:*` + tipo (feature / bug / mejora) + prioridad.

Backfill: `powershell -File scripts/backfill-proyecto-field.ps1`

## Skills backlog (portfolio-skills)

### Published (Done)

| ID | Skill | Deliverables |
|----|-------|--------------|
| P-01 | API Testing | 3 SUTs, Gherkin, Postman, Rest-Assured, Playwright C#, Selenium, Senior report |
| P-02 | Performance | JMeter plan, Gherkin AC-PERF, manual + CLI, report |

### In progress

| ID | Skill | Goal | Practice on site |
|----|-------|------|------------------|
| B-01 | **Docker** | Deep-dive lab: images, compose, healthchecks, troubleshooting | [Practice Labs](docs/guides/index.html) Lab 1 |
| B-02 | **CI/CD — GitHub Actions** | Extend workflows: Newman, matrix all SUTs, badges | Lab 3 + `.github/workflows/` |
| B-05 | **Agile PM — GitHub Projects** | Board + field **Proyecto** + vistas por app | [Lab 4](docs/guides/index.html) + [setup guide](projects/agile/github-projects/README.md) |

### Planned

| ID | Skill | Goal | Accounts required |
|----|-------|------|-------------------|
| B-03 | **CI/CD — Azure DevOps** | Mirror pipelines (build SUTs, api-tests, Pages deploy) | **Azure** free + **Azure DevOps** org |
| B-04 | **CI/CD — Jenkins** | `Jenkinsfile`, agent in Docker, same test stages | Local Docker; optional SaaS later |

## Product Owner — QA Job Hunter

Track **PO** · Proyecto board: **`job-hunter`** · detalle: [`projects/qa-job-hunter/BACKLOG.md`](projects/qa-job-hunter/BACKLOG.md)

| ID | Status | Scope |
|----|--------|--------|
| P-JH-01…04 | Done | Scrape, LLM match, dashboard, feedback |
| B-06 | Sprint / refined | MongoDB persistence |
| B-13 | Sprint / refined | Multi-source jobs |
| B-07…B-16+ | Planned / in flight | Agent, tracking, site, CV, monetization, … |

Vista filtrada: Project → **Proyecto — Job Hunter** (crear en UI si aún no existe; ver [README agile](projects/agile/github-projects/README.md)).

## Account checklist

- [x] **GitHub** — `gabrielagarayzavalia` (repo + Actions + Pages)
- [ ] **Azure** — when starting B-03
- [ ] **Azure DevOps** — when starting B-03
- [ ] **Jenkins** — Docker local for B-04
- [x] **Agile PM — GitHub Projects** — board + field **Proyecto**

## Conventions per mini-project

Each backlog item ships with:

1. Gherkin user story + acceptance criteria  
2. Manual test cases  
3. Automated tests (where applicable)  
4. Senior QA report + screenshots  
5. Bilingual subpage under `docs/`  
6. Practice lab section in `docs/guides/`

## Suggested order (skills)

1. Finish Docker lab content (B-01)
2. Harden GitHub Actions (B-02)
3. Azure DevOps parallel pipeline (B-03)
4. Jenkins pipeline as code (B-04)
5. Keep GitHub Projects healthy (B-05): field **Proyecto**, vistas, labels `mini-project:*`
