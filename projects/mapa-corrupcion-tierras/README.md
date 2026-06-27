# Mapa de corrupción y tierras en Argentina

Visualización interactiva de casos históricos documentados donde el poder político y la tierra se cruzan por provincia y período.

**Qué muestra:** escándalos, tierras fiscales, disputas judiciales y concentración territorial con fuentes periodísticas o académicas.

**Qué no es:** un catastro de transferencias de campos entre políticos ni un registro oficial de propiedad.

## Inicio rápido

```bash
cd projects/mapa-corrupcion-tierras
python -m venv .venv
.venv\Scripts\activate          # Windows
pip install -r requirements.txt
python scripts/fetch_georef.py  # solo la primera vez
python scripts/build_jitter.py  # regenerar datos con jitter
python app.py
```

Abrí http://127.0.0.1:8050

Para detener la app:

```powershell
.\stop.ps1          # puerto 8050 (default)
.\stop.ps1 -Port 8050
```

## Estructura

| Ruta | Descripción |
|------|-------------|
| `data/casos_tierra_argentina_base.csv` | Dataset original (10 columnas) |
| `data/casos_tierra_argentina_final.csv` | Dataset con coordenadas y categorías |
| `data/provincias.geojson` | Polígonos provinciales (Georef) |
| `scripts/build_jitter.py` | ETL: jitter + CSV de salida |
| `output/casos_tierra_argentina_jitter.csv` | Datos listos para el mapa |
| `app.py` | App Dash (coroplético + puntos + filtros) |

## Filtros

- **Década:** bins de 1800 a 2020 (`anio_inicio`)
- **Categoría:** `corrupcion_historica`, `condena`, `tierras_fiscales`, etc.

## Limitaciones

- Coordenadas por centroide provincial; casos de una misma provincia se separan con jitter (~900 m).
- La región **Patagonia** aparece como puntos pero no colorea el coroplético (no es provincia Georef).
- Casos con rango amplio (p. ej. 1900–1999) se ubican solo en la década de `anio_inicio`.
- `estado_judicial` mezcla resultados judiciales y contexto histórico en algunas filas.

## Fuentes

- [Georef Argentina](https://www.argentina.gob.ar/georef) — polígonos provinciales
- [Escándalo de El Palomar (Infobae)](https://www.infobae.com/sociedad/2022/12/08/sobreprecios-y-venta-de-tierras-en-el-palomar-el-caso-de-corrupcion-que-casi-hizo-caer-a-un-presidente-argentino/)
- Investigación base derivada de trabajo con Perplexity sobre casos documentados
