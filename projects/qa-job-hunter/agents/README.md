# Sub-agentes de campaña (bajo qa-job-hunter)

Taxonomía canónica del orquestador `npm run campaign`. Cada carpeta es un **agente**; la herramienta (Gmail API, Playwright, Excel) vive dentro.

| Agente | Rol | Entrada npm |
|--------|-----|-------------|
| `gmail-fetch` | Trae mails de empleo / labels Empleo | `npm run agent:gmail-fetch` |
| `pipeline-match` | Clasifica, match skills → Excel | `npm run agent:pipeline` |
| `easy-apply` | Easy Apply LinkedIn (Playwright + sesión) | `npm run easy-apply` |
| `excel-bridge` | Export cola + abrir `Empleos_Tracker.xlsx` | `npm run agent:excel` |
| `gmail-reconcile` | Reorganiza labels Gmail según Excel | `npm run agent:gmail-reconcile` |

## Orden correcto

```
fetch → pipeline → easy-apply → Excel (manual) → reconcile
```

Reconcile va **después** de que edites Excel. No abre Gmail UI ni mailto.

## Código fuente (Fase 2)

Hoy `gmail-fetch`, `pipeline-match` y `gmail-reconcile` **delegan** al proyecto hermano `qa-job-applied-list` vía env `APPLIED_LIST_ROOT` (default: `~/projects/QA-portfolio/projects/qa-job-applied-list`).

Easy Apply y excel-bridge viven en este repo (`src/easy-apply*.ts`, `src/apply/post-run.ts`).

Taxonomía de labels Gmail: `docs/gmail-labels.md` en applied-list hasta migrar el código completo aquí.
