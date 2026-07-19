# Easy Apply — Flujo, selectores y plantilla de pasos (B17-01)

Spike **JH-T-B17-01** de la story **US-JH-B17** (_Easy Apply automatizado desde grabación_).

> **Estado:** primera grabación registrada en `recordings/easy-apply/simple-apply.spec.ts`
> (multistep + radio; UI EN). Textos canónicos en `src/apply/canonical-text.ts`.
> Seed de respuestas: `src/apply/apply-answers.example.json`.

---

## 1. Cómo grabar

Requisito: `npm run login` → `session/linkedin-session.json`.

**No uses `<>` alrededor de la URL** (en Windows son redirección).

```bash
# Desde projects/qa-job-hunter
npm run playwright:ide -- --url=https://www.linkedin.com/jobs/view/JOB_ID --label=simple-apply
npm run playwright:ide -- --url=https://www.linkedin.com/jobs/view/JOB_ID --label=multistep
npm run playwright:ide -- --url=https://www.linkedin.com/jobs/view/JOB_ID --label=preguntas
```

- Codegen carga la sesión (`--load-storage`) y escribe en `recordings/easy-apply/<label>.spec.ts`.
- Tras cerrar Codegen, revisá el archivo (sesión relativa, dry-run, textos genéricos).

---

## 2. Riesgos operativos (acordados)

### 2.1 JobId destructivo
Un **Submit real** en LinkedIn “quema” ese aviso para re-pruebas. Después de un apply real, tomar un **job nuevo** de la hoja/CSV del pipeline (`output/jobs-result.csv`).

### 2.2 Estados en Excel (`ApplyStatus`)

| Estado | Final | Cuándo |
|---|---|---|
| `pendiente` | No | Default; sin Easy Apply; dry-run hasta Submit |
| `enviada` | No* | Applied en UI o Submit+Done en productivo |
| `cerrada` | Sí | Marcado manual / negocio — no se pisa |
| `descartada` | Sí | Marcado manual / negocio — no se pisa |

\* `enviada` no pisa `cerrada` ni `descartada`.

### 2.3 Dry-run (pruebas) vs productivo

```bash
npm run easy-apply:dry-run   # pruebas: hasta Submit, SIN click; Excel sigue pendiente
npm run easy-apply           # productivo: Submit + Done → Excel enviada
```

- Cola: `output/apply/apply-queue.csv` (+ sync `jobs-result.csv`).
- Applied / **Application submitted** / Ya postulaste → **enviada** (salvo `cerrada`/`descartada`).
- Aviso **ya no acepta** / no disponible / closed → **cerrada** → siguiente.
- Sin Easy Apply (y no closed/applied) → **sigue pendiente** → siguiente.
- Dry-run + Easy Apply → ver Submit, no clickear → **pendiente**.
- Si hay Easy Apply y **no entra al modal** → **STOP** de toda la corrida (exit 2); no seguir al siguiente.
- Si **Next no avanza** (required) → captura campos a `output/apply/required-fields-*.json`, **cierra sesión** (exit 3). Pseudo-fill: Location/comuna 9 → tipar **Liniers** (`fill-answers.ts`).
- Productivo + Easy Apply → Submit → **Done** → **enviada**.
- Idioma base LinkedIn: **inglés**.

Env dry-run: `DRY_RUN_MAX=10`, `DRY_RUN_ALL=1`.

### 2.3 Preguntas Sí/No
Aparecen de forma variable. Heurística: defaults + patrones en `apply-answers.example.json`; preguntas desconocidas → registrar en `output/apply/apply-answers.json` (gitignore) para reutilizar (motor completo = B17-2 / B17-4).

### 2.4 CV / resumen / cover letter — opcionales
Pueden **no aparecer**. Si el control está visible → rellenar con textos genéricos de `canonical-text.ts` (**sin** nombre de la empresa solicitante). Si no → skip.

---

## 3. Variante observada (grabación real)

Archivo: `recordings/easy-apply/simple-apply.spec.ts`  
Job: `4438016042` · UI: inglés · Variante: **multistep + pregunta radio** (no “simple” 1-clic).

Secuencia observada:

1. `getByRole('link', { name: 'Easy Apply to this job' })`
2. `Continue to next step` × 3
3. Radio / texto `Sí` (pregunta del empleador)
4. `Review your application`
5. `Submit application` → `Done` _(solo apply real; en dry-run se detiene antes)_

En ese aviso **no** pidieron CV picker / summary / cover (opcionales ausentes).

Patrón de prueba generalizado:

```
abrir Easy Apply
→ (opcional) elegir CV / fill resumen / fill cover
→ mientras haya Next/Continue: contestar yes/no conocidos → Next
→ al ver Submit: STOP (dry-run) | Submit solo en apply real
```

---

## 4. Selectores: estables vs frágiles

Priorizar `getByRole` / `aria-label` (EN observados + fallbacks ES).

| Elemento | Selector | Estabilidad | Nota |
|---|---|---|---|
| Easy Apply | `getByRole('link', { name: 'Easy Apply to this job' })` | Estable | **Es link, no button** (codegen Macro/GLOBAL HR) |
| Easy Apply (fallback) | otros `link`/`button` con Easy Apply | Heurística | Solo si falla el primario |
| Continuar / Next | `button` **o** `link` (`modal-controls.ts`) | Estable | Probar ambos roles |
| Revisar | idem Review | Estable | |
| Enviar / Submit | idem Submit application | Estable | Dry-run: detectar, no click |
| Done | idem Done/Listo | Estable | Post-submit |
| Yes/No | `getByText(/^Sí$\|^Yes$/i)` | Media | Heurística; ampliar con apply-answers |
| Modal | `getByRole('dialog')` | Estable | |
| Cover/summary | `dialog textarea` | Media | **Opcional** |
| CV picker | (variable por UI LinkedIn) | Frágil | **Opcional** |
| Primario genérico | `button.artdeco-button--primary` | Frágil | Último recurso |

---

## 5. Textos canónicos

Fuente: `src/apply/canonical-text.ts`

- `APPLICATION_SUMMARY` — resumen genérico
- `COVER_LETTER_DEFAULT` — cover genérica
- `RESUME_LABEL_HINT` — criterio de elección de CV

`cover-letter.ts` usa `COVER_LETTER_DEFAULT` como fallback final.

---

## 6. Plantilla de pasos (input B17-3)

```ts
type StepAction = "goto" | "click" | "fill" | "select" | "check" | "expect" | "screenshot";

interface FlowStep {
  action: StepAction;
  selector?: string;
  value?: string;
  valueRef?: string;
  optional?: boolean;
  note?: string;
}
```

Ejemplo alineado a la grabación (dry-run):

```json
{
  "variant": "multistep",
  "jobId": "4438016042",
  "dryRun": true,
  "steps": [
    { "action": "click", "selector": "getByRole('link', { name: 'Easy Apply to this job' })" },
    { "action": "fill", "selector": "dialog textarea[summary]", "valueRef": "summary", "optional": true },
    { "action": "fill", "selector": "dialog textarea[cover]", "valueRef": "coverLetter", "optional": true },
    { "action": "click", "selector": "Continue to next step", "optional": true, "note": "repetir mientras exista" },
    { "action": "check", "selector": "Sí|Yes", "valueRef": "yesNo", "optional": true },
    { "action": "click", "selector": "Review your application", "optional": true },
    { "action": "expect", "selector": "Submit application", "note": "dry-run: NO click" }
  ]
}
```

---

## 7. Riesgos ToS (resumen B17-7)

- Automatizar postulaciones puede violar ToS de LinkedIn: límites, delays (B17-5), dry-run por defecto.
- `session/` y `.env` nunca se commitean.
- Las grabaciones no deben llevar path absoluto de sesión ni datos personales sensibles.

---

## 8. Checklist del spike

- [x] Primera grabación real → `recordings/easy-apply/simple-apply.spec.ts` (multistep + radio)
- [x] Selectores EN documentados + dry-run pre-Submit
- [x] Textos canónicos genéricos + seed `apply-answers.example.json`
- [ ] Caso “simple” puro (1 paso, sin preguntas) — grabar cuando aparezca
- [ ] Caso `preguntas` dedicado (varios tipos de control) — grabar aparte
- [ ] Motor de aprendizaje yes/no completo (B17-2 / B17-4)
