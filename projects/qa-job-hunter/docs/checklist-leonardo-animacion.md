# Checklist — Flujo Leonardo gratis (sin API)

**Objetivo:** animación 30–40 s estilo línea (Pantera Rosa) para QA Job Hunter.  
**Marcá con `[x]`** lo que vayas completando. Pedile al agente que actualice este doc si cambia el flujo.

**Carpeta local (binarios):** `C:\Users\gabri\projects\qa-job-hunter-demo\animacion\`  
**Guion completo:** [`demo-guion-animacion.md`](demo-guion-animacion.md)

---

## Progreso rápido

| Fase | Estado |
|------|--------|
| 0. Preparación | ⬜ |
| 1. Personaje ancla | ⬜ |
| 2. Keyframes (4 escenas) | ⬜ |
| 3. Clips animados | ⬜ |
| 4. Montaje CapCut | ⬜ |
| 5. Export final | ⬜ |

*Actualizá la tabla a mano: ⬜ → 🟡 en curso → ✅ listo*

---

## 0. Preparación (~5 min)

- [ ] Cuenta creada en [leonardo.ai](https://leonardo.ai) (plan gratis)
- [ ] Carpetas locales listas (`ancla/`, `keyframes/`, `clips/`, `export/`)
- [ ] Leonardo abierto en **Image Generation**
- [ ] Modelo elegido: **Phoenix** o **Leonardo Diffusion XL**
- [ ] Aspect ratio: **16:9**
- [ ] Tokens del día verificados (si no alcanza, planificar Día 1 / Día 2)

**Notas:**

```
(fecha / tokens disponibles / bloqueos)
```

---

## 1. Personaje ancla

Generar **una** imagen referencia del hombrecito narigón. Guardar en `ancla/personaje-ancla.png`.

### Prompt (copiar)

```
1960s cartoon line art, Pink Panther style, black ink lines only on white background,
NO color fill, NO shading, NO grayscale,
simple nose man character, dot eyes, striped shirt, thin limbs, expressive pose,
full body side view, clean minimal background, 2D animation cel style
```

### Negative prompt

```
color, shading, gradient, 3D, realistic, photorealistic, filled colors, gray tones
```

### Checklist

- [ ] Prompt pegado y generadas 4 variantes
- [ ] Elegida la mejor (solo líneas negras, fondo blanco/crema)
- [ ] Descargada como `ancla/personaje-ancla.png`
- [ ] ¿Sirve como ancla? (si no → regenerar con `pure black lines, white background only`)

**Notas:**

```
(cuál variante elegiste / qué ajustar)
```

---

## 2. Keyframes — 4 escenas

En **cada** generación:
- Subir `personaje-ancla.png` en **Image Guidance** (fuerza **0.6–0.75**)
- Mismo modelo y ratio 16:9
- Guardar en `keyframes/`

### Escena 1 — Pila de papeles

**Archivo:** `keyframes/escena-01-pila.png`

**Prompt:**

```
1960s cartoon line art, black ink lines only on white, NO fill NO shading,
Pink Panther style, nose man carrying HUGE stack of papers saying POSTULATE A X,
jumping between platforms labeled Buscar, Copiar CV, Pegar formulario,
papers falling, exhausted, side view 2D cartoon
```

- [ ] Generada
- [ ] Descargada
- [ ] Aprobada (o regenerada)

### Escena 2 — Split nadando vs sudando

**Archivo:** `keyframes/escena-02-split.png`

**Prompt:**

```
1960s line art black on white only, split screen:
LEFT nose man with tie floating in pool thinking, thought bubbles lupa percent check, relaxed;
RIGHT same nose man sweating at vintage computer, papers everywhere, frantic typing;
NO color fill, 2D cartoon
```

- [ ] Generada
- [ ] Descargada
- [ ] Aprobada (si split sale mal → 2 imágenes separadas y unir en CapCut)

### Escena 3 — Plataformas pipeline

**Archivo:** `keyframes/escena-03-plataformas.png`

**Prompt:**

```
1960s line art black on white, nose man with tie jumping on platforms
labeled Scrape, Match %, Auto-apply, Tracker,
paper stack shrinking, last paper becomes ordered list table Empresa Estado Proximo paso,
2D cartoon, NO fill
```

- [ ] Generada
- [ ] Descargada
- [ ] Aprobada

### Escena 4 — Casa vs PC de noche

**Archivo:** `keyframes/escena-04-casa.png`

**Prompt:**

```
1960s line art black on white, nose man with tie in simple line-art house on couch
reading short checklist with checkmarks, happy;
second panel same nose man tired at computer at night huge paper pile;
2D cartoon, NO fill
```

- [ ] Generada
- [ ] Descargada
- [ ] Aprobada

**Notas escenas:**

```
(escena que costó más / trucos que funcionaron)
```

---

## 3. Clips animados (5 s c/u)

Elegí **una** vía (o mezclá si se acaban tokens).

### Opción A — Leonardo Motion

- [ ] Escena 1 → Motion → `clips/escena-01.mp4`
- [ ] Escena 2 → Motion → `clips/escena-02.mp4`
- [ ] Escena 3 → Motion → `clips/escena-03.mp4`
- [ ] Escena 4 → Motion → `clips/escena-04.mp4`

**Prompt movimiento (ej.):** `subtle cartoon movement, character bounces, papers fall, line art style`

### Opción B — Kling image-to-video (si Motion no alcanza)

- [ ] Cuenta en [klingai.com](https://klingai.com)
- [ ] Escena 1: subir PNG → 5 s → `clips/escena-01.mp4`
- [ ] Escena 2 → `clips/escena-02.mp4`
- [ ] Escena 3 → `clips/escena-03.mp4`
- [ ] Escena 4 → `clips/escena-04.mp4`

**Notas clips:**

```
(Leonardo o Kling / problemas de estilo)
```

---

## 4. Montaje CapCut (~20 min)

- [ ] Proyecto nuevo 16:9 1080p
- [ ] Importados los 4 clips en orden
- [ ] Transiciones: corte seco o dissolve 0.2 s
- [ ] Texto escena 2: contador `Postulaciones: 3` (manual) y `Postulaciones: 18` (QA Hunter)
- [ ] Texto escena 4: `24 ✓` vs `5...`
- [ ] Cierre 2 s: **QA Job Hunter — de la pila al pipeline.**
- [ ] Música jazz libre de derechos (volumen bajo)
- [ ] Revisión duración total 30–40 s

**Notas montaje:**

```
```

---

## 5. Export y control de calidad

- [ ] Export `export/qa-job-hunter-anim-v1.mp4` (1080p 16:9)
- [ ] Solo líneas negras, sin rellenos raros
- [ ] Personaje reconocible en todas las escenas
- [ ] Contadores legibles ≥ 2 s
- [ ] CTA final visible
- [ ] (Opcional) Corte vertical 9:16 para Reels → `export/qa-job-hunter-anim-v1-vertical.mp4`

**Notas finales:**

```
(listo para publicar / qué mejorar en v2)
```

---

## Troubleshooting (marcá lo que probaste)

| Problema | Fix | Probado |
|----------|-----|---------|
| Sale con color o grises | Negative prompt + `ink sketch only` | [ ] |
| Personaje distinto por escena | Image Guidance 0.8 + misma ancla | [ ] |
| Split screen feo | 2 imágenes + CapCut lado a lado | [ ] |
| Sin tokens hoy | Pausar; continuar mañana | [ ] |
| Motion muy caro en tokens | Pasar a Kling i2v | [ ] |

---

## Historial de cambios al flujo

| Fecha | Cambio |
|-------|--------|
| 2026-07-26 | Checklist inicial creado |

*El agente agrega filas acá cuando ajustemos el proceso.*
