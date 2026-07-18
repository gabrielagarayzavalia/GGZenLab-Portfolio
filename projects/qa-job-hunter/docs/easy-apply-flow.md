# Easy Apply — Flujo, selectores y plantilla de pasos (B17-01)

Spike **JH-T-B17-01** de la story **US-JH-B17** (_Easy Apply automatizado desde grabación_).
Objetivo: grabar con Playwright codegen el flujo Easy Apply real sobre 2-3 avisos y
documentar las variantes y selectores, para alimentar el motor de replay parametrizado (**B17-3**).

> Estado: estructura + selectores candidatos + plantilla lista.
> Las secciones marcadas `[COMPLETAR TRAS GRABAR]` requieren correr codegen con tu sesión
> real de LinkedIn (login + posible 2FA), algo que es manual por diseño.

---

## 1. Cómo grabar

Requisito: tener sesión guardada (`npm run login` genera `session/linkedin-session.json`).

```bash
# Caso simple (1 paso: CV de LinkedIn + Enviar)
npm run playwright:ide -- --url=<URL_DEL_AVISO> --label=simple

# Caso multi-paso (Continuar / Review / Enviar)
npm run playwright:ide -- --url=<URL_DEL_AVISO> --label=multistep

# Caso con preguntas (radios, dropdowns, campos numéricos)
npm run playwright:ide -- --url=<URL_DEL_AVISO> --label=preguntas
```

- Codegen abre Chromium con tu sesión cargada (`--load-storage`).
- Interactuás con el flujo real; al cerrar la ventana, el script grabado queda en
  `recordings/easy-apply/<label>.spec.ts`.
- Esas grabaciones son la **evidencia del spike** y el insumo para extraer selectores.

---

## 2. Variantes del flujo

### 2.1 Caso simple — CV de LinkedIn + Enviar
Un solo paso: el modal muestra el CV ya cargado y el botón **Enviar solicitud**.

- Pasos observados: abrir modal → (opcional) confirmar CV → Enviar → confirmación.
- `[COMPLETAR TRAS GRABAR]`: pegar los pasos exactos y locators desde `recordings/easy-apply/simple.spec.ts`.

### 2.2 Caso multi-paso — Continuar / Review / Enviar
Varios pasos encadenados con **Continuar** / **Siguiente** / **Revisar** antes de **Enviar**.

- Pasos observados: abrir modal → datos contacto → (repetir Continuar) → Revisar → Enviar.
- Punto frágil: cantidad de pasos variable; hay que iterar hasta encontrar Enviar/Review.
- `[COMPLETAR TRAS GRABAR]`: secuencia real de botones y cuántos pasos tuvo.

### 2.3 Caso con preguntas — radios, dropdowns, numéricos
El modal incluye preguntas del empleador (screening questions).

- Tipos frecuentes: radios (sí/no), dropdowns (años de experiencia), inputs numéricos, texto libre.
- Punto frágil: los labels y `name`/`id` de estos campos cambian por aviso; no son estables.
- `[COMPLETAR TRAS GRABAR]`: listar preguntas encontradas + tipo de control + valor que corresponde.

---

## 3. Selectores: estables vs frágiles

Derivados del baseline heurístico (`src/easy-apply.ts`). Regla general:
**priorizar `getByRole` y `aria-label`** sobre clases `artdeco-*` (que LinkedIn cambia seguido).

| Elemento | Selector candidato | Estabilidad | Nota |
|---|---|---|---|
| Botón Easy Apply | `button[aria-label*='Easy Apply']`, `button[aria-label*='Solicitud sencilla']` | Estable | Preferir aria-label localizado (ES/EN) |
| Botón Easy Apply (fallback) | `button.jobs-apply-button` | Media | Clase puede cambiar |
| Modal | `div[role='dialog']` | Estable | Preferir role sobre `.jobs-easy-apply-modal` |
| Modal (fallback) | `.jobs-easy-apply-modal`, `[data-test-modal]` | Media | `data-test-*` es mejor que clase |
| Botón Continuar/Siguiente | `button[aria-label*='Continuar']`, `button[aria-label*='Next']` | Estable | Localizado ES/EN |
| Botón Revisar | `button[aria-label*='Review']`, `button[aria-label*='Revisar']` | Estable | |
| Botón Enviar | `button[aria-label*='Enviar solicitud']`, `button[aria-label*='Submit application']` | Estable | Clave para cerrar el flujo |
| Botón primario (fallback) | `button.artdeco-button--primary` | Frágil | Solo como último recurso |
| Cover letter | `div[role='dialog'] textarea` | Media | Puede haber >1 textarea |
| Confirmación enviada | `text=/Solicitud enviada|Application submitted/i` | Media | Depende del idioma |
| Cerrar modal | `button[aria-label='Dismiss']`, `button[aria-label='Cerrar']` | Estable | |

`[COMPLETAR TRAS GRABAR]`: reemplazar/confirmar cada fila con los locators reales que
genere codegen, y anotar en `output/apply/selectors.json` los que difieran.

---

## 4. Plantilla de pasos (input para B17-3)

Formato propuesto para describir un flujo grabado como datos reproducibles.
Los valores personales **no se hardcodean**: se referencian por clave (`valueRef`) y el
resolver los toma de `apply-answers.json` (B17-2).

### 4.1 Esquema de un paso

```ts
type StepAction = "goto" | "click" | "fill" | "select" | "check" | "expect" | "screenshot";

interface FlowStep {
  action: StepAction;
  selector?: string;      // locator estable (ver sección 3)
  value?: string;         // valor literal (solo para datos NO sensibles)
  valueRef?: string;      // clave a resolver desde apply-answers.json (ej. "phone")
  optional?: boolean;     // si no aparece, se saltea sin fallar
  note?: string;          // por qué / cuándo aplica
}

interface EasyApplyFlow {
  variant: "simple" | "multistep" | "preguntas";
  steps: FlowStep[];
}
```

### 4.2 Ejemplo (caso simple)

```json
{
  "variant": "simple",
  "steps": [
    { "action": "click", "selector": "button[aria-label*='Easy Apply']", "note": "abrir modal" },
    { "action": "expect", "selector": "div[role='dialog']", "note": "modal visible" },
    { "action": "fill", "selector": "div[role='dialog'] textarea", "valueRef": "coverLetter", "optional": true },
    { "action": "screenshot", "note": "pre-submit" },
    { "action": "click", "selector": "button[aria-label*='Enviar solicitud']", "note": "enviar" },
    { "action": "expect", "selector": "text=/Solicitud enviada|Application submitted/i", "note": "confirmación" }
  ]
}
```

### 4.3 Ejemplo (con preguntas) — esqueleto

```json
{
  "variant": "preguntas",
  "steps": [
    { "action": "click", "selector": "button[aria-label*='Easy Apply']" },
    { "action": "expect", "selector": "div[role='dialog']" },
    { "action": "select", "selector": "[COMPLETAR: dropdown años exp]", "valueRef": "yearsExperience" },
    { "action": "check", "selector": "[COMPLETAR: radio autorización trabajo]", "valueRef": "workAuthorization" },
    { "action": "fill", "selector": "[COMPLETAR: input numérico salario]", "valueRef": "salaryExpectation", "optional": true },
    { "action": "click", "selector": "button[aria-label*='Revisar']" },
    { "action": "click", "selector": "button[aria-label*='Enviar solicitud']" }
  ]
}
```

`[COMPLETAR TRAS GRABAR]`: completar los selectores de las preguntas reales y las claves
`valueRef` necesarias, que definirán el schema de `apply-answers.json` en B17-2.

---

## 5. Riesgos y ToS (resumen para B17-7)

- Automatizar postulaciones puede violar los Términos de Servicio de LinkedIn: usar con
  criterio, con límites diarios y delays (guardrails de B17-5), en modo dry-run por defecto.
- La sesión (`session/`) y las credenciales (`.env`) **nunca** se commitean (ver `.gitignore`).
- Las grabaciones `.spec.ts` no deben contener datos personales sensibles: la sesión se
  inyecta aparte vía `--load-storage`, no queda en el script.

---

## 6. Checklist del spike

- [ ] Grabar caso simple → `recordings/easy-apply/simple.spec.ts`
- [ ] Grabar caso multi-paso → `recordings/easy-apply/multistep.spec.ts`
- [ ] Grabar caso con preguntas → `recordings/easy-apply/preguntas.spec.ts`
- [ ] Confirmar tabla de selectores (sección 3) con los locators reales
- [ ] Completar plantilla de pasos (sección 4) por variante
- [ ] Definir claves `valueRef` → insumo de B17-2 (`apply-answers.json`)
