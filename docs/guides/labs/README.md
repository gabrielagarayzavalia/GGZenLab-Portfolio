# Laboratorios QA — GGZenLab Portfolio

Guías **modo instructor** (paso a paso, checkpoints). El agente debe pausar en cada checkpoint hasta tu confirmación.

## Orden recomendado

| Lab | Archivo | Tema |
|-----|---------|------|
| **LAB-00** | [LAB-00-setup-ggzenlab.md](./LAB-00-setup-ggzenlab.md) | Workspace, paths, Docker Desktop |
| **LAB-01** | [LAB-01-sql-select-join.md](./LAB-01-sql-select-join.md) | PostgreSQL en Docker + SELECT/JOIN |
| **LAB-02** | [LAB-02-cicd-github-actions-qa.md](./LAB-02-cicd-github-actions-qa.md) | CI/CD para QA Automation |
| **LAB-03** | [LAB-03-b06-4-mongo-qa.md](./LAB-03-b06-4-mongo-qa.md) | Mongo persistence (Job Hunter) |
| **LAB-04** | [LAB-04-playwright-pom-typescript.md](./LAB-04-playwright-pom-typescript.md) | Playwright + POM (TS) — próximo |
| **LAB-05** | [LAB-05-rest-assured-api.md](./LAB-05-rest-assured-api.md) | Rest Assured + API (Java/Maven) |
| **LAB-06** | [LAB-06-powershell-qa.md](./LAB-06-powershell-qa.md) | PowerShell esencial (Windows + QA labs) |

## Skills de avisos de empleo (planificados)

Labs para cubrir requisitos frecuentes en job postings que aún no están en mini-proyectos publicados. Ver también la [tabla de progreso](../../qa/labs/index.html).

| Lab | Archivo | Skill típica en avisos |
|-----|---------|------------------------|
| **LAB-07** | [LAB-07-llm-voice-agents-qa.md](./LAB-07-llm-voice-agents-qa.md) | AI/LLM, voice agents, conversational automation |
| **LAB-08** | [LAB-08-webrtc-sip-livekit-ivr.md](./LAB-08-webrtc-sip-livekit-ivr.md) | SIP, WebRTC, LiveKit, contact center / IVR |
| **LAB-09** | [LAB-09-latency-performance-qa.md](./LAB-09-latency-performance-qa.md) | TTFT, call setup time, response timing |
| **LAB-10** | [LAB-10-contract-testing-wiremock.md](./LAB-10-contract-testing-wiremock.md) | Contract testing, WireMock, mock services |
| **LAB-11** | [LAB-11-terraform-cloud-qa.md](./LAB-11-terraform-cloud-qa.md) | Terraform, cloud infrastructure |

## Proceso y colaboración (planificados)

| Lab | Archivo | Tema |
|-----|---------|------|
| **LAB-12** | [LAB-12-scrum-kanban-planning-qa.md](./LAB-12-scrum-kanban-planning-qa.md) | Scrum, Kanban, planning, trazabilidad AC → tests |
| **LAB-13** | [LAB-13-slack-setup-usage-qa.md](./LAB-13-slack-setup-usage-qa.md) | Seteo Slack, canales, GitHub, plantillas QA |

### Job Hunter / automatización (planificados — ir agregando)

| Lab | Tema |
|-----|------|
| LAB-JH-14 | API dashboard (Postman/Newman) |
| LAB-JH-15 | UI Playwright + POM |
| LAB-JH-16 | Performance k6 |
| LAB-JH-17 | CI/CD Job Hunter en GitHub Actions |

Registro de instancias (estado, fechas, contador): [`docs/qa/labs/index.html`](../../qa/labs/index.html) · datos en [`projects/labs/`](../../../projects/labs/).

Labs del subsitio publicado: [`docs/guides/index.html`](../index.html) · Job Hunter Mongo: [`docs/projects/qa-job-hunter/`](../projects/qa-job-hunter/)

---

## ¿Nuevo chat o seguir en el mismo?

### Seguí en **el mismo chat** cuando:

- Estás en una **secuencia de aprendizaje** (LAB-00 → 01 → 02 → 03…)
- El agente ya conoce tu entorno (paths, Docker, errores previos)
- Estás en la **misma epic/story** (ej. todo B-06)
- Pedís **“Lab X, paso N”** y retomás donde quedaste

### Abrí **chat nuevo** cuando:

- Cambiás de **track grande** (QA labs → Product Owner feature nueva)
- El chat está **muy largo** y el agente repite o pierde foco
- Querés un **PR / review limpio** de un cambio ya terminado
- Arrancás un **lab distinto** sin relación (ej. JMeter hoy, Playwright mañana en sesión fresca)

### Workspace

| Concepto | Path |
|----------|------|
| **Monorepo (Cursor, git, docker)** | `C:\Users\gabri\projects\GGZenLab-Portfolio` |
| **Job Hunter hunter** | `...\projects\qa-job-hunter` |
| **Job Hunter applied-list** | `...\projects\qa-job-applied-list` |

**Recomendación:** abrí en Cursor la **raíz** `GGZenLab-Portfolio`. La carpeta `QA-portfolio` está **retirada** — no recrear.

### Regla práctica (1 línea)

> **Un chat = un hilo de práctica o una epic; chat nuevo = tema nuevo o hilo demasiado largo.**

---

## Labs remediales

Si fallás 3+ veces en el mismo concepto, pedí: *“lab remediial sobre X”* — el agente agrega un mini-lab focalizado antes de seguir.
