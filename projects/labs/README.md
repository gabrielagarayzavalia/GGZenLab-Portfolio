# Labs — hub de laboratorios QA

Subproyecto de **metadatos y progreso** para los labs instructor del portfolio. La infra de cada lab sigue en su carpeta existente (`sql-lab`, `api-testing`, `qa-job-hunter`, etc.).

## Archivos

| Archivo | Rol |
|---------|-----|
| [`catalog.json`](catalog.json) | Catálogo LAB-00…11 — guías, frameworks, skills de avisos |
| [`instances.json`](instances.json) | Instancias lab+framework con estado, fechas y contador |
| [`scripts/sync-registry-to-docs.ps1`](scripts/sync-registry-to-docs.ps1) | Publica JSON en `docs/qa/labs/data/` (GitHub Pages) |

## Tracks

| Track | Labs | Notas |
|-------|------|-------|
| **foundation** | LAB-00…06 | Guías publicadas o en curso |
| **job-skills** | LAB-07…11 | Skills pedidas en avisos de empleo aún no cubiertas en el portfolio |

### LAB-07…11 — skills de avisos

| Lab | Skill típica en avisos |
|-----|------------------------|
| LAB-07 | AI/LLM, voice agents, conversational automation |
| LAB-08 | SIP, WebRTC, LiveKit, contact center / IVR |
| LAB-09 | Latency validation — TTFT, call setup, response timing |
| LAB-10 | Contract testing, WireMock, mock services |
| LAB-11 | Terraform, cloud infrastructure |

## Flujo con el agente (modo instructor)

1. **Iniciar lab:** *"Quiero LAB-07 en Ollama eval"* → instancia `LAB-07-ollama-eval`, `status: in_progress`, `startedAt: hoy`.
2. **Variante nueva:** *"Mismo LAB-04 pero en Java Selenium"* → nueva fila `LAB-04-java-selenium`.
3. **Reintento:** lab completado otra vez → `attemptCount++`, `startedAt` nueva, `completedAt: null`.
4. **Sync:** `pwsh projects/labs/scripts/sync-registry-to-docs.ps1`
5. **Commit:** actualizar `instances.json` (y `catalog.json` si hay lab nuevo), sync, commit en español.

## Sync a GitHub Pages

```powershell
pwsh projects/labs/scripts/sync-registry-to-docs.ps1
```

Source of truth: `projects/labs/`. Copia servible: `docs/qa/labs/data/`.

## Tabla web

[`docs/qa/labs/index.html`](../../docs/qa/labs/index.html) — progreso por instancia.

Guías paso a paso: [`docs/guides/labs/README.md`](../../docs/guides/labs/README.md).
