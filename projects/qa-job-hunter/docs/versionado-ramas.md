# Versionado de ramas — qa-job-hunter (GGZenLab)

Política vigente tras cierre de v1 y emparejamiento v2/main. Hermano: `qa-job-applied-list` (misma política).

## Repo canónico

- **Path:** `GGZenLab-Portfolio/projects/qa-job-hunter`
- **Remote:** `gabrielagarayzavalia/GGZenLab-Portfolio`
- Hermano applied-list: `GGZenLab-Portfolio/projects/qa-job-applied-list` (mismo monorepo local).

## Líneas

| Línea | Rol | Estado |
|-------|-----|--------|
| **`release/v1`** + tags `v1-final` | Archivo | **Cerrada.** Sin PRs nuevos. |
| **`release/v2`** | Campaña + features | **Línea activa.** Trabajo nuevo acá. |
| **`main`** | Integración | **Mismo contenido** que `release/v2` (sync tras cada merge a v2). |
| **`refactor/desacoplar-dominios`** | Histórico #150 | Alineada a `main`; no es línea de features nuevas. |

## Reglas operativas

1. **Trabajo nuevo** → rama desde **`release/v2`**, PR a **`release/v2`**.
2. Tras merge a **`release/v2`** → **sync** `main` ← `release/v2` (PR squash si no hay FF).
3. **Nunca** PR directo a `main` salvo hotfix acordado.
4. **Campaña diaria v2** → `release/v2`.
5. **Nunca** merge `release/v1` ↔ `main` / `release/v2`.

## Botoneras (dos productos distintos)

| Botonera | Repo / path | Uso |
|----------|-------------|-----|
| **Desktop (PowerShell)** | `qa-job-applied-list/desktop/botonera.ps1` | Gmail, pipeline, reconcile |
| **Web (dashboard)** | `dashboard/` (`run.html`, `config.html`) | Easy Apply, Config, campaña hunter |

## Tips actuales (post-emparejamiento 2026-07-25)

| Rama | SHA | Nota |
|------|-----|------|
| `release/v2` | `64907bf` | Línea activa |
| `main` | `ec631be` | Mismo árbol que v2 (squash en main) |

## Relacionado

- Applied-list: `qa-job-applied-list/docs/versionado-ramas.md`
- Desacople: GGZenLab-Portfolio#150
- Botonera web: PR #255 / #254
