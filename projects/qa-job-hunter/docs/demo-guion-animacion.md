# Demo QA Job Hunter — guion + animación

Material de marketing para lanzamiento. Demo en pantalla (~75 s) y prompt para animación estilo línea (Pantera Rosa).

---

## Guion demo en pantalla (~75 s)

**Formato:** screen recording + voz en off (o solo texto en pantalla).  
**Objetivo:** Excel caótico → pipeline ordenado en una pasada.

| Tiempo | Visual | Voz / texto |
|--------|--------|-------------|
| **0–8 s** | Excel abierto: muchas filas, colores mezclados, columnas desalineadas. Zoom a celda “Postular a X”. | *“Buscar trabajo en QA no es solo encontrar avisos. Es perseguir 40 postulaciones en 10 pestañas y perder el hilo.”* |
| **8–15 s** | Corte a LinkedIn: scroll infinito, mismo aviso repetido, pestañas abiertas. | *“Scrolleás, copiás, pegás… y al día siguiente no sabés en qué quedó cada una.”* |
| **15–22 s** | Logo / título: **QA Job Hunter**. Dashboard carga. | *“QA Job Hunter junta todo en un solo pipeline.”* |
| **22–35 s** | Dashboard: lista de jobs con match %, fuente, botón campaña. Filtro “solo QA” / match alto. | *“Scrapea ofertas, las puntúa por match y te muestra qué vale la pena primero.”* |
| **35–48 s** | Click en campaña / Easy Apply (dry-run o 1 apply real). Barra de progreso. | *“Lanzás una campaña: el sistema postula por vos y registra cada envío.”* |
| **48–60 s** | Tracker web (`/tracker`): grilla con estados (Pendiente → Enviada → Entrevista). Filtro por estado. Mobile lite 2 s. | *“Todo cae al tracker: estado, empresa, próximo paso. Desde el celu también.”* |
| **60–70 s** | Split: izquierda Excel viejo (caos), derecha tracker limpio con contador “12 enviadas esta semana”. | *“De la pila de ‘postulate a X’ a una lista que podés leer en 10 segundos.”* |
| **70–75 s** | CTA pantalla negra: **Probá la demo** · lista de espera Pro. | *“Organizá tu búsqueda. Probá QA Job Hunter.”* |

### Tips de grabación

- Datos demo anonimizados.
- Una sola transición “whoosh” entre Excel y app.
- Música jazz suave (guiño Pantera Rosa, sin copyright) muy baja.
- Contador visible en tracker si es posible.

---

## Prompt animación (estilo línea · Pantera Rosa)

Copiar y pegar completo. Combina pile jumping, paralelo nadando vs sudando, y cierre en casa.

```
Animación corta (30-45 segundos), estilo dibujo animado clásico de los años 60-70,
como la Pantera Rosa: solo líneas negras sobre fondo blanco o crema,
SIN relleno de color, SIN sombreado, trazos expresivos y minimalistas.
Personaje principal: hombrecito narigón, cuerpo simple, ojos puntos, camisa rayada.
Estilo ink line art, 2D, fluidez cartoon, humor silencioso.

ESCENA 1 (0-8s): Hombrecito A carga una pila GIGANTE de papeles.
Cada papel dice "POSTULATE A X" en letras grandes.
Salta de plataforma en plataforma etiquetadas: "Buscar" → "Copiar CV" → "Pegar formulario" → "¿Ya postulé?".
En cada salto, 2-3 papeles se le caen. La pila NO baja; él sigue agotado.

ESCENA 2 (8-18s) — PARALELO split screen:
IZQUIERDA: Hombrecito B (mismo diseño, corbata) flota en una piscina pensando,
burbujas de pensamiento con iconos: lupa, %, check. Relajado.
DERECHA: Hombrecito A sudando frente a una computadora vintage,
papeles por todos lados, tecleando frenético, gotas de sudor animadas.
Contador bajo A: "Postulaciones: 3" (sube muy lento).
Contador bajo B: "Postulaciones: 18" (sube rápido).

ESCENA 3 (18-28s): Hombrecito B salta etapas como plataformas de videojuego:
"Scrape" → "Match %" → "Auto-apply" → "Tracker".
En cada etapa la pila de papeles "POSTULATE A X" se REDUCE visiblemente:
18 → 12 → 7 → 3 → 1 hoja que se transforma en una LISTA ORDENADA
(columnas: Empresa | Estado | Próximo paso), mismo estilo línea sin color.

ESCENA 4 (28-38s): Hombrecito B llega a su casita (línea simple), se sienta en un sillón,
lee una lista corta de pendientes con checkmarks. Sonrisa tranquila.
Contador B: "Postulaciones: 24 ✓"
Corte a Hombrecito A todavía frente a la máquina de noche, ojeras, pila igual de grande.
Contador A: "Postulaciones: 5..."
Texto final en línea gruesa: "QA Job Hunter — de la pila al pipeline."

TÉCNICA: cámara lateral 2D, movimiento suave, timing cómico pausas estilo slapstick,
fondo siempre limpio, máximo 2 personajes + objetos simples,
consistencia del personaje en todos los frames, export 16:9, 1080p.
Sin diálogos hablados; solo música jazz ligera opcional.
```

### Si la IA solo genera clips de 5 s

Pedir escena por escena y unir en CapCut o DaVinci (gratis).

---

## IAs gratis sugeridas

| # | Herramienta | Por qué | Limitación |
|---|-------------|---------|------------|
| 1 | [Kling AI](https://klingai.com) | Créditos diarios gratis; prompts largos con estilo y narrativa; buen movimiento cartoon. | El estilo “solo línea” a veces agrega grises — reforzar “NO fill, NO shading” en cada clip. |
| 2 | [Hailuo AI](https://hailuoai.video) | Tier gratis generoso; escenas con 2 personajes y split screen. | Consistencia del narigón entre clips: misma descripción de personaje en cada generación. |
| 3 | [Leonardo AI](https://leonardo.ai) | Tokens diarios; imagen línea primero, luego Motion sobre el frame. | Más trabajo manual, pero el estilo Pantera Rosa sale más fiel. |

**Workflow alternativo:** Leonardo → 4 keyframes (una por escena) → Kling image-to-video 5 s c/u → CapCut para unir + contadores animados a mano.

---

Relacionado: backlog **B-10** (monetización) · wireframe demo en [`spike-tracker-web.md`](spike-tracker-web.md).
