# GitHub Projects — GGZenLab agile setup

Tool chosen for **B-05 Agile PM**: [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects).

## Quick links

| Resource | URL |
|----------|-----|
| New Project | https://github.com/users/gabrielagarayzavalia/projects/new |
| Repo Issues | https://github.com/gabrielagarayzavalia/QA-portfolio/issues |
| New Issue (templates) | https://github.com/gabrielagarayzavalia/QA-portfolio/issues/new/choose |

---

## GGZenLab workflow (your agile model)

Two **separate** concepts — do not mix them:

| Concept | Where it lives | Meaning |
|---------|----------------|---------|
| **Product Backlog** | **Iteration = Backlog** (or no sprint) | Everything refined or not yet pulled into the **current sprint**. Not a Status column. |
| **Sprint board** | **Current Iteration** + **Status** | Only work committed to this sprint; moves column by column until Done. |

```mermaid
flowchart LR
  subgraph backlog [Product Backlog - not Status]
    PB[Epics Stories Tasks waiting]
  end
  subgraph sprint [Sprint board - Status columns]
    TD[To Do]
    IP[In Progress]
    IR[In Review]
    RQA[Ready for QA]
    QIP[QA In Progress]
    DN[Done]
  end
  PB -->|Sprint planning: assign Iteration| TD
  TD --> IP --> IR --> RQA --> QIP --> DN
```

### Status field (sprint board only)

Configure **only these** values — **no Backlog, no Ready**:

| Order | Status | Who / what |
|-------|--------|------------|
| 1 | **To Do** | In sprint, not started (replaces “Ready”) |
| 2 | **In Progress** | Dev, automation, or doc work in flight |
| 3 | **In Review** | PR open, spec/report peer review |
| 4 | **Ready for QA** | Handoff to QA; AC and build available |
| 5 | **QA In Progress** | Manual/automated test execution, evidence |
| 6 | **Done** | AC met, evidence attached, accepted |

**Delete** from Status (if the template added them): `Backlog`, `Ready`.

---

## Step 1 — Create the project

1. https://github.com/users/gabrielagarayzavalia/projects/new
2. **Template:** **Team backlog**
3. **Name:** `GGZenLab QA Portfolio`
4. **Link repo:** `gabrielagarayzavalia/QA-portfolio`

---

## Step 2 — Iterations (backlog vs sprint)

1. Project → **⋯** → **Settings** → ensure **Iterations** is enabled (Team backlog includes it).
2. You get a built-in **Backlog** iteration — items here are **not** on the sprint board.
3. Create **Sprint 1** (e.g. 1 week dates).

> **Stop here if the project has no issues yet.** Step 2.4 (sprint planning) is in **Step 8**, after you create and add issues.

---

## Step 3 — Reform Status field

1. Project → **⋯** → **Settings** → **Fields** → **Status** → **Edit**
2. Remove: `Backlog`, `Ready` (and any duplicate).
3. Add / order:

   `To Do` → `In Progress` → `In Review` → `Ready for QA` → `QA In Progress` → `Done`

4. Save.

---

## Step 4 — Two views

### View A — Product Backlog (table)

- **Name:** `Product Backlog`
- **Layout:** Table
- **Filter:** `Iteration` is `Backlog` (or “no iteration”)
- **Group by:** `Epic` or `Mini-project` label
- **Do not** use Status here as “backlog”; iteration is the backlog.

### View B — Sprint board (Kanban)

- **Name:** `Sprint Board`
- **Layout:** Board
- **Filter:** `Iteration` = `@current` (current sprint)
- **Group by:** **Status** (columns = To Do … Done)
- Only sprint items appear; backlog stays in View A.

Optional **Table** view for QA traceability: columns Title, Status, AC-ID, Tool, Labels.

---

## Step 5 — Custom fields (optional)

Project → **Settings** → **Fields** → New field:

| Field | Type | Example |
|-------|------|---------|
| AC-ID | Text | AC-001 |
| Mini-project | Single select | api-testing, performance-jmeter |
| Tool | Single select | Postman, Rest-Assured, JMeter |

---

## Step 6 — Labels (repo)

Repo → **Issues** → **Labels**:

| Label | Purpose |
|-------|---------|
| `epic` | Mini-project / skill |
| `user-story` | Gherkin story |
| `task` | Manual or automation work |
| `mini-project:api` | API testing |
| `mini-project:perf` | Performance |
| `qa-manual` | Manual test task |
| `qa-automation` | Automation task |

---

## Step 7 — Create issues (repo) and add to project

**Issues live in the repo first**, then you link them to the Project. An empty project cannot do sprint planning.

### 7.1 Create issues in the repo

Open: https://github.com/gabrielagarayzavalia/QA-portfolio/issues/new/choose

**Minimum to start (create in this order):**

| # | Template | Title |
|---|----------|-------|
| 1 | Epic | `[Epic] EPIC-API — API Testing mini-project` |
| 2 | User Story | `[Story] US-API-ABM — REST ABM and listing` |
| 3 | QA Task | `[Task] TC-M-001 — Manual POST create (Postman)` |

Copy bodies from [SEED_ISSUES.md](SEED_ISSUES.md) if templates are empty.

### 7.2 Add issues to the Project

1. Open your **GGZenLab QA Portfolio** project.
2. Bottom of any view → **Add item** (or `+`).
3. Search `EPIC-API` / issue number → Add.
4. Repeat for each issue.

New items should show **Iteration: Backlog** automatically.

### 7.3 Verify Product Backlog view

Open view **Product Backlog** — you should see your 3 issues with Iteration = Backlog.

---

## Step 8 — Sprint planning (this was “step 4.4”)

**Only when issues appear in the project:**

1. Open **Sprint Board** (or Table with Iteration column).
2. Select issues for Sprint 1 (e.g. the task `TC-M-001`).
3. Set **Iteration** → `Sprint 1`.
4. Set **Status** → `To Do`.

Drag on the board or edit fields on the right panel.

---

## Step 9 — Sprint practice (1 week)

| Day | Action |
|-----|--------|
| Planning | Move 3–5 tasks to **Sprint 1**, Status **To Do** |
| Execute | **In Progress** — Docker lab, run tests |
| Review | **In Review** — link PR or report draft |
| QA handoff | **Ready for QA** — AC listed, SUT up |
| Testing | **QA In Progress** — Postman / Rest-Assured, screenshot |
| Close | **Done** — checkbox AC on issue + evidence |

---

## Traceability

```
Epic (EPIC-API)
  └── User Story (US-API-ABM) ← gherkin/abm-crud.feature
        ├── Task TC-M-001 (Postman) → AC-001
        └── Task TC-A-001 (Rest-Assured) → AC-001
```

Portfolio evidence: screenshot of **Sprint Board** + issue URLs → `projects/api-testing/report/screenshots/`.

Site: [Practice Labs Lab 4](../../../docs/guides/index.html).
