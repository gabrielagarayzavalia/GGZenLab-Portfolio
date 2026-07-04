# Guía — Reportar y arreglar un bug (Git + agentes Cursor)

**Repo:** `gabrielagarayzavalia/GGZenLab-Portfolio`  
**Regla activa:** `.cursor/rules/git-workflow-main-protegido.mdc`  
**Relacionada:** [GUIA-12-PASOS-GIT-GGZenLab.md](./GUIA-12-PASOS-GIT-GGZenLab.md)

---

## ¿Bug en un chat nuevo?

**Sí.** Cada chat nuevo con un agente debe:

1. Abrir el repo `GGZenLab-Portfolio` en Cursor (la regla Git se aplica sola).
2. **Copiar el bloque de inicio** (abajo) al primer mensaje.
3. Trabajar siempre en rama **`fix/`**, nunca en `main`.

Los chats viejos no “recuerdan” ramas ni PRs; por eso conviene **nuevo chat + instrucción explícita**.

---

## Bloque para pegar en chat nuevo (agente)

Copiá y completá las líneas entre `< >`:

```text
Bug en GGZenLab-Portfolio.

Reglas Git (obligatorio):
- NO commitear ni pushear a main
- Crear/usar rama: fix/<nombre-corto>
- Al terminar: commit en español, push, PR a main
- No mergear el PR salvo que yo lo pida

Bug:
- Qué pasa: <descripción>
- Esperado: <comportamiento correcto>
- Pasos para reproducir: <1, 2, 3>
- Área: <ej. projects/qa-job-hunter/dashboard>

Empezá creando la rama fix/ desde main actualizado.
```

---

## Flujo paso a paso (humano + agente)

### Fase 1 — Preparar (vos o el agente)

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
git checkout main
git pull origin main
git switch -c fix/nombre-del-bug
git branch --show-current
```

**Nombre de rama:** `fix/` + kebab-case corto  
Ejemplos: `fix/dashboard-not-selected`, `fix/launcher-env-missing`

---

### Fase 2 — Reportar el bug (contenido mínimo)

| Campo | Ejemplo |
|-------|---------|
| **Qué pasa** | Error `LI_EMAIL` al scrapear |
| **Esperado** | Lee credenciales desde `.env` |
| **Reproducir** | Launcher → opción 2 |
| **Archivos** | `config.ts`, `.env` |

Opcional: issue en GitHub antes del PR (no obligatorio en repo personal).

---

### Fase 3 — Arreglo y commit

El agente (o vos) edita solo lo necesario.

```powershell
git status -sb
git add <archivos>
$m = "Corregir X porque Y"
git commit -m $m
```

---

### Fase 4 — Push y PR

```powershell
git push -u origin fix/nombre-del-bug
```

Abrí:

```text
https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/compare/main...fix/nombre-del-bug
```

**Título PR:** `fix: descripción corta`

**Descripción PR (plantilla):**

```markdown
## Bug
- Qué fallaba
- Cómo se reproducía

## Fix
- Qué se cambió y por qué

## Test plan
- [ ] Paso 1 para verificar
- [ ] Paso 2
```

**Merge:** Squash and merge (como PR #69).

---

### Fase 5 — Cerrar en tu PC

```powershell
git checkout main
git pull origin main
```

---

## fix/ vs hotfix/ vs wip/

| Prefijo | Cuándo |
|---------|--------|
| `fix/` | Bug normal |
| `hotfix/` | Urgente en `main` ya mergeado (algo roto en producción/uso diario) |
| `wip/` | Agente explorando; **no mergear** hasta revisar |

---

## Errores frecuentes

| Problema | Solución |
|----------|----------|
| Agente commitea en `main` | Branch protection + bloque de inicio en chat nuevo |
| Chat nuevo sin contexto | Pegar bloque de arriba + rama `fix/` |
| `Awaiting approval` en PR | Settings → Branches → `main` → desmarcar Require approvals |
| Perdí commits | `git reflog` → `git switch -c rescue/... HASH` → push |

---

## Ejemplo real en este repo

| Item | Valor |
|------|--------|
| Bug | Credenciales, shortcut OneDrive, regla agentes |
| Rama | `fix/qa-job-hunter-env-y-shortcut` |
| PR | #69 |
| Merge | Squash → `git pull` en `main` |

---

## Checklist rápido (bug)

- [ ] Chat nuevo con bloque de instrucciones Git
- [ ] `main` actualizado
- [ ] Rama `fix/...` creada
- [ ] Bug reproducido y descrito
- [ ] Fix + commit + push
- [ ] PR a `main` con Test plan
- [ ] Merge + `git pull` en `main`

---

*GGZenLab Portfolio — uso con agentes Cursor y trabajo en solitario.*
