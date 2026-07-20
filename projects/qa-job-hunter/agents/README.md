# Sub-agentes de campaña (bajo qa-job-hunter)

Taxonomía canónica del orquestador `npm run campaign`. Cada carpeta es un **agente**; la herramienta (Gmail API, Playwright, Excel) vive dentro.

Story: [US-JH-B23 #131](https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/issues/131).

| Agente | Rol | Entrada npm |
|--------|-----|-------------|
| `gmail-fetch` | Trae mails de empleo / labels Empleo | `npm run agent:gmail-fetch` |
| `pipeline-match` | Clasifica, match skills → Excel | `npm run agent:pipeline` |
| `excel-bridge` | Export cola + abrir `Empleos_Tracker.xlsx` (revisión) | `npm run agent:excel` |
| `easy-apply` | Easy Apply LinkedIn (Playwright + sesión) — **canónico** | `npm run easy-apply` |
| `gmail-reconcile` | Reorganiza labels Gmail según Excel | `npm run agent:gmail-reconcile` |

## Orden correcto

```
fetch → pipeline → Excel (revisión) → easy-apply → reconcile
```

Easy Apply canónico = **este repo** (GGZenLab). Applied-list = Gmail / pipeline / reconcile.  
El clone bajo QA-portfolio/`qa-job-hunter` no es el motor de apply.

Excel canónico: Escritorio (`Empleos_Tracker.xlsx`).

## Código fuente

Hoy `gmail-fetch`, `pipeline-match` y `gmail-reconcile` **delegan** al proyecto hermano `qa-job-applied-list` vía env `APPLIED_LIST_ROOT` (default: `~/projects/QA-portfolio/projects/qa-job-applied-list`).

Easy Apply y excel-bridge viven en este repo (`src/easy-apply*.ts`, `src/apply/post-run.ts`).

Taxonomía de labels Gmail: `docs/gmail-labels.md` en applied-list hasta migrar el código completo aquí.
