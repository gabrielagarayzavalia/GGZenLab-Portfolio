# LAB-13 — Slack: seteo del workspace y uso para QA

**Tipo:** colaboración / tooling  
**Duración:** ~45–60 min  
**Estado:** guía preparada · practicar en chat con instructor  
**Objetivo:** Configurar Slack para trabajo QA/portfolio: canales, notificaciones útiles, integraciones con GitHub y buenas prácticas (sin ruido).

---

## Qué piden en avisos

- Comunicación en equipos distribuidos
- Herramientas: Slack, Jira, Confluence (según empresa)
- Reporte de bugs y coordinación con dev/PO

Este lab es **genérico** (cualquier workspace) con ejemplos alineados a **Job Hunter / campaña**.

---

## Prerrequisitos

- Cuenta Slack (gratis OK) o workspace de práctica
- Opcional: admin del workspace para instalar apps
- LAB-12 recomendado si querés enlazar ceremonias → canales

---

## Paso 1/6 — Estructura de canales (mínimo viable)

**Acción:** creá o documentá esta estructura (nombres ajustables):

| Canal | Propósito | Quién escribe |
|-------|-----------|---------------|
| `#general` | Avisos suaves del proyecto | Todos |
| `#job-hunter-dev` | PRs, merges, dudas técnicas | Vos + agentes/bots |
| `#job-hunter-qa` | Smokes, bugs, evidencia screenshots | QA (vos) |
| `#job-hunter-campaña` | Corridas Gmail/apply, resultados diarios | Vos |
| `#random` | Off-topic | Opcional |

**Reglas anti-ruido:**

- Un hilo por bug o por corrida de campaña
- No pegar logs de 500 líneas — usar gist o archivo + resumen 3 líneas
- `@channel` solo para bloqueos reales

**Checkpoint ✋:** listá tus canales reales (o los que crearías) y una regla por canal.

---

## Paso 2/6 — Perfil y notificaciones (TDAH-friendly)

**Acción en Slack → Preferences → Notifications:**

| Config | Sugerencia |
|--------|------------|
| Horario | Quiet hours fuera de tu bloque de foco |
| Keywords | `bloqueado`, `PR listo`, `campaña` |
| Móvil | Solo mentions directas + keywords |
| Desktop | Badge sin sonido para canales low-priority |

**Checkpoint ✋:** ¿Qué canal dejás en “mute” por defecto?

---

## Paso 3/6 — Integración GitHub (opcional pero útil)

**Si tenés permiso de admin:**

1. Slack → **Apps** → buscar **GitHub**
2. `/github subscribe gabrielagarayzavalia/GGZenLab-Portfolio`
3. En `#job-hunter-dev`, suscribir solo lo necesario:
   - `pull requests` (opened, merged)
   - `issues` (opcional: solo `labeled: priority:high`)
   - Evitar: cada commit en `release/v2`

**Comandos útiles:**

```text
/github subscribe owner/repo pulls
/github unsubscribe owner/repo commits
```

**Sin integración:** pegar link del PR manualmente con plantilla:

```text
PR #430 — banner assessments — listo para review
https://github.com/.../pull/430
Smoke: npm run test:match-jobs OK
```

**Checkpoint ✋:** ¿GitHub app instalada sí/no? Si no, usá plantilla manual una vez.

---

## Paso 4/6 — Plantillas de mensaje QA

Copiá y adaptá:

**Bug report corto**

```text
🐛 [dashboard] Filtro A-realizado count 0 con 15 en Gmail Realizados
Repo: GGZenLab-Portfolio · Issue: #429 (spike)
Pasos: 1) dashboard 2) filtro A-realizado
Esperado: count ≥1 · Actual: 0
Evidencia: screenshot en hilo
```

**Smoke post-merge**

```text
✅ Smoke post #430 (banner #421)
- test:match-jobs 34/34
- Manual: banner warn con seed assessment
Rama: release/v2 @ 43be683
```

**Campaña diaria**

```text
📬 Campaña 2026-08-01
- Gmail fetch: OK · N msgs
- Match: 782 ≥65%
- Apply: 0 (solo pipeline)
Próximo: reconcile assessments
```

**Checkpoint ✋:** enviá un mensaje de prueba (a vos misma o canal privado) usando plantilla bug.

---

## Paso 5/6 — Slack + flujo Agile (enlace LAB-12)

| Ceremonia | Dónde en Slack |
|-----------|----------------|
| Daily | Hilo fijo semanal en `#job-hunter-dev` |
| Planning | Mensaje pin con sprint goal + 3 links a issues |
| Review/Demo | `#job-hunter-qa` + screenshot dashboard |
| Retro | Emoji poll :+1: / :-1: en hilo retro |

**Checkpoint ✋:** ¿Qué ceremonia harías 100% async en Slack?

---

## Paso 6/6 — Seguridad y secretos

**Nunca en Slack:**

- Tokens Gmail, `.env`, cookies LinkedIn
- URLs con credenciales

**Sí:**

- Links a issues/PRs públicos o privados del repo
- IDs de job, títulos de avisos (sin datos personales de terceros)

**Checkpoint ✋:** confirmá que no pegaste secretos en el mensaje de prueba del paso 4.

---

## Integraciones futuras (fuera de scope v1)

- Webhook campaña → canal `#job-hunter-campaña` (cuando exista notifier)
- Slack + GitHub Actions (fallo CI → alerta)
- Recordatorios assessment (#421 banner → Slack) — requiere story aparte

---

## Definition of Done (lab)

- [ ] ≥3 canales definidos con propósito
- [ ] Notificaciones configuradas (quiet hours o mute)
- [ ] GitHub app **o** plantilla manual probada
- [ ] 1 mensaje bug + 1 mensaje smoke enviados (aunque sea DM a vos)

---

## Para arrancar en chat

> **Lab 13 Slack, paso 1** — modo instructor.
