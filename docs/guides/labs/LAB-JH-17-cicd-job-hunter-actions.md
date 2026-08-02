# LAB-JH-17 — CI/CD Job Hunter (GitHub Actions)

**Tipo:** CI/CD · monorepo  
**Duración:** ~60 min  
**Estado:** guía preparada · instructor  
**Objetivo:** Workflow que corre en PR a `release/v2`: unit API + match-jobs + (opcional) Newman smoke.

**Extiende:** LAB-02 (genérico) · específico `projects/qa-job-hunter`

---

## Prerrequisitos

- LAB-02 · LAB-JH-14 (colección Postman lista)
- Repo `GGZenLab-Portfolio` · permisos Actions

## Outline

1. Explorar `.github/workflows/` actual
2. Job `qa-job-hunter`: checkout → setup Node → `npm ci` en subcarpeta
3. Steps: `npm run test:match-jobs`, `test:api`, `test:tracker` (subset rápido)
4. (Opcional) service Mongo en CI o mock — documentar limitación
5. (Opcional) Newman solo en `workflow_dispatch` o nightly
6. Branch protection: required check en PR a `release/v2`

**Checkpoint ✋:** PR de prueba con check verde en GitHub.

> **Lab JH-17, paso 1** — modo instructor.
