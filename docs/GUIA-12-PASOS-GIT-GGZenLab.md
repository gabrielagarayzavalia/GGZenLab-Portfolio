# Guía de 12 pasos — Git y QA Job Hunter
## GGZenLab Portfolio · Flujo Dev Lead Sr

**Repo:** `https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio`  
**Proyecto:** `projects/qa-job-hunter/`  
**Última actualización:** julio 2026

---

## Resumen visual

```
main (protegido)  ←── solo entra por PR merge
    ↑
 feature/*  fix/*  chore/*  (trabajo diario)
    ↑
 push → Pull Request → merge → git pull en main local
```

---

## Paso 1 — Regla de oro

| Qué | Regla |
|-----|--------|
| `main` | Siempre estable; refleja lo mergeado en GitHub |
| Ramas | Todo trabajo nuevo va en `feature/`, `fix/`, `chore/`, etc. |
| Integración | **Solo Pull Request** hacia `main` |
| Prohibido | Push directo a `main`, `reset --hard` en `main` sin rama de respaldo |

**Convención de nombres:** `tipo/descripcion-corta`  
Ejemplos: `feature/qa-job-hunter-desktop-launcher`, `fix/qa-job-hunter-env-y-shortcut`

---

## Paso 2 — Empezar una tarea (rama nueva)

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio
git checkout main
git pull origin main
git switch -c feature/mi-tarea
git branch --show-current   # debe NO decir "main"
```

---

## Paso 3 — Trabajar y commitear en la rama

- Editá archivos con Cursor o a mano.
- Mensajes de commit en **español**, enfocados en el **por qué**.
- **No** commitear: `.env`, secretos, capturas locales (`Captura*` ya está en `.gitignore`).

```powershell
git status -sb
git add <archivos>
git commit -m "Descripcion clara del cambio"
```

**PowerShell — commit con mensaje largo:**

```powershell
$m = "Tu mensaje de commit aqui"
git commit -m $m
```

---

## Paso 4 — Verificar antes del PR (checklist)

Antes de abrir PR, confirmar:

- [ ] Estás en rama feature/fix (no `main`)
- [ ] Los archivos clave existen (`git log -3`, `dir` si aplica)
- [ ] `git status` sin sorpresas (solo lo que querés incluir)
- [ ] Secretos fuera del repo (`.env` local, `config.ts` gitignored)

**Ejemplo QA Job Hunter:** launcher en `scripts/`, dashboard con `not_selected`, etc.

---

## Paso 5 — Push a GitHub

```powershell
git push -u origin HEAD
```

Verificar remoto:

```powershell
git ls-remote --heads origin nombre-de-tu-rama
```

---

## Paso 6 — Crear Pull Request

1. Abrir: `https://github.com/gabrielagarayzavalia/GGZenLab-Portfolio/compare/main...TU-RAMA`
2. **Base:** `main` · **Compare:** tu rama
3. Título claro + descripción (Summary + Test plan)
4. **Create pull request**

---

## Paso 7 — Merge y actualizar PC

1. En GitHub: **Squash and merge** (recomendado para fixes chicos) o **Merge pull request**
2. En PC:

```powershell
git checkout main
git pull origin main
```

---

## Paso 8 — Proteger `main` en GitHub

**Settings → Branches → Add rule (classic)**

| Campo | Valor |
|-------|--------|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ |
| Require approvals | ❌ (si trabajás sola) |

**Save changes**

---

## Paso 9 — Regla Cursor para agentes

Archivo en repo: `.cursor/rules/git-workflow-main-protegido.mdc`  
**Always apply:** instructs agents to usar ramas + PR, nunca push a `main`.

Al abrir chat nuevo con agente, indicar: *"Trabajá en rama `feature/xxx`, no toques main."*

---

## Paso 10 — Fixes en rama `fix/` (ejemplo real)

```powershell
git checkout main
git pull origin main
git switch -c fix/descripcion-corta
# ... cambios ...
git add .
git commit -m "Mensaje del fix"
git push -u origin fix/descripcion-corta
# → PR → merge (ej. PR #69)
```

---

## Paso 11 — Credenciales LinkedIn (`.env`)

LinkedIn **no** usa credenciales hardcodeadas en `config.ts` commiteado. Usar `.env`:

```powershell
cd projects\qa-job-hunter
copy .env.example .env
notepad .env
```

Contenido (valores reales solo en tu PC):

```
LI_EMAIL=tu@email.com
LI_PASS=tu_password
```

Probar:

```powershell
npx tsx -e "import { LINKEDIN_CREDENTIALS } from './src/config.ts'; console.log('OK:', LINKEDIN_CREDENTIALS.email ? 'si' : 'no')"
```

---

## Paso 12 — Launcher Escritorio + cierre de sesión

### Acceso directo (una vez)

```powershell
cd C:\Users\gabri\projects\GGZenLab-Portfolio\projects\qa-job-hunter
scripts\create-desktop-shortcut.bat
```

Doble clic en **QA Job Hunter.lnk** → menú (scrape+analyze, dashboard, etc.).

### Checklist al cerrar sesión con agente

- [ ] ¿Trabajo en rama con push hecho?
- [ ] ¿PR creado o mergeado?
- [ ] ¿`.env` con secretos solo local?
- [ ] ¿`main` local actualizado tras merge?

### Recuperación de emergencia (reflog)

Si perdiste commits:

```powershell
git reflog --oneline -20
git switch -c rescue/nombre COMMIT_HASH
git push -u origin rescue/nombre
```

---

## Referencia rápida — PRs de este proyecto

| PR | Contenido |
|----|-----------|
| #68 | Launcher .bat + dashboard + gitignore Captura |
| #69 | .env, shortcut OneDrive, regla Cursor |
| #70 | Guía 12 pasos Git |

**Guía bugs / agentes (chat nuevo):** [GUIA-FIX-BUG-GIT-AGENTES.md](./GUIA-FIX-BUG-GIT-AGENTES.md)

---

## Comandos de una línea

```powershell
# Estado
git status -sb && git branch --show-current && git log --oneline -3

# Nueva feature
git pull origin main && git switch -c feature/nueva-tarea

# Publicar
git push -u origin HEAD
```

---

*Documento generado para GGZenLab Portfolio — uso personal e instructores.*
