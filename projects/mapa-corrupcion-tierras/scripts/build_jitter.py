"""Genera CSV con jitter y GeoJSON de puntos desde el dataset final."""

from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

SCRIPT_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = SCRIPT_DIR.parent
sys.path.insert(0, str(SCRIPT_DIR))

from geo_utils import apply_geo_jitter, export_geojson_from_csv, normalize_provincia

INPUT_CSV = PROJECT_ROOT / "data" / "casos_tierra_argentina_final.csv"
OUTPUT_DIR = PROJECT_ROOT / "output"
CSV_OUT = OUTPUT_DIR / "casos_tierra_argentina_jitter.csv"
GEOJSON_OUT = OUTPUT_DIR / "casos_tierra_argentina_jitter.geojson"

REQUIRED_COLUMNS = {
    "provincia",
    "anio_inicio",
    "caso",
    "lat",
    "lon",
    "categoria_visual",
    "grupo_tematico",
}


def main() -> None:
    if not INPUT_CSV.exists():
        raise FileNotFoundError(f"No se encontró el CSV de entrada: {INPUT_CSV}")

    df = pd.read_csv(INPUT_CSV)
    missing = REQUIRED_COLUMNS - set(df.columns)
    if missing:
        raise ValueError(f"Columnas faltantes en {INPUT_CSV.name}: {sorted(missing)}")

    for col in ("lat", "lon"):
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df["provincia"] = df["provincia"].map(normalize_provincia)
    df = df.dropna(subset=["lat", "lon"]).copy()
    df = df.sort_values(["provincia", "anio_inicio", "caso"]).reset_index(drop=True)

    df_jitter = apply_geo_jitter(
        df,
        group_cols=["provincia", "lat", "lon"],
        lat_col="lat",
        lon_col="lon",
        jitter_meters=900,
        seed=7,
    )

    df_jitter["categoria_visual"] = df_jitter["categoria_visual"].fillna("sin_categoria")
    df_jitter["grupo_tematico"] = df_jitter["grupo_tematico"].fillna("sin_grupo")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    df_jitter.to_csv(CSV_OUT, index=False, encoding="utf-8-sig")
    export_geojson_from_csv(CSV_OUT, GEOJSON_OUT)

    grupos = (
        df_jitter.groupby(["provincia", "lat", "lon"], dropna=False)
        .size()
        .reset_index(name="n")
        .sort_values("n", ascending=False)
    )

    print(f"CSV guardado en: {CSV_OUT}")
    print(f"GeoJSON guardado en: {GEOJSON_OUT}")
    print(f"Filas procesadas: {len(df_jitter)}")
    if not grupos.empty:
        top = grupos.iloc[0]
        print(f"Mayor superposición: {top['provincia']} ({int(top['n'])} casos)")


if __name__ == "__main__":
    main()
