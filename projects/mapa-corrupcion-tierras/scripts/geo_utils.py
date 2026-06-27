"""Utilidades geográficas: jitter radial y exportación GeoJSON."""

from __future__ import annotations

import json
from pathlib import Path

import numpy as np
import pandas as pd

PROVINCIA_MAP = {
    "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
}


def normalize_provincia(name: str) -> str:
    if pd.isna(name):
        return name
    return PROVINCIA_MAP.get(str(name), str(name))


def apply_geo_jitter(
    df: pd.DataFrame,
    group_cols: list[str],
    lat_col: str = "lat",
    lon_col: str = "lon",
    jitter_meters: float = 800,
    seed: int = 42,
) -> pd.DataFrame:
    """Separa puntos superpuestos en un patrón radial alrededor del centroide."""
    rng = np.random.default_rng(seed)
    out = df.copy()

    out["lat_jitter"] = out[lat_col].astype(float)
    out["lon_jitter"] = out[lon_col].astype(float)
    out["grupo_coord_id"] = out[group_cols].astype(str).agg("|".join, axis=1)
    out["orden_jitter"] = np.nan
    out["cantidad_en_grupo"] = np.nan

    for _, g in out.groupby(group_cols, dropna=False):
        idx = g.index.to_list()
        n = len(idx)

        if n <= 1:
            continue

        lat0 = float(g.iloc[0][lat_col])
        lon0 = float(g.iloc[0][lon_col])

        angles = np.linspace(0, 2 * np.pi, n, endpoint=False)
        if n > 3:
            rng.shuffle(angles)

        radii = np.linspace(jitter_meters * 0.25, jitter_meters, n)
        lat_per_meter = 1 / 111320.0
        lon_per_meter = 1 / (111320.0 * np.cos(np.radians(lat0)))

        for i, row_idx in enumerate(idx):
            dx = radii[i] * np.cos(angles[i])
            dy = radii[i] * np.sin(angles[i])

            out.at[row_idx, "lat_jitter"] = lat0 + dy * lat_per_meter
            out.at[row_idx, "lon_jitter"] = lon0 + dx * lon_per_meter
            out.at[row_idx, "orden_jitter"] = i + 1
            out.at[row_idx, "cantidad_en_grupo"] = n

    out["orden_jitter"] = out["orden_jitter"].fillna(1).astype(int)
    out["cantidad_en_grupo"] = out["cantidad_en_grupo"].fillna(1).astype(int)

    return out


def df_to_geojson(
    df: pd.DataFrame,
    properties: list[str],
    lat: str = "lat_jitter",
    lon: str = "lon_jitter",
) -> dict:
    geojson = {"type": "FeatureCollection", "features": []}

    for _, row in df.iterrows():
        feature = {
            "type": "Feature",
            "properties": {},
            "geometry": {
                "type": "Point",
                "coordinates": [float(row[lon]), float(row[lat])],
            },
        }
        for prop in properties:
            val = row[prop]
            if pd.isna(val):
                val = None
            elif isinstance(val, (np.integer, np.floating)):
                val = val.item()
            feature["properties"][prop] = val
        geojson["features"].append(feature)

    return geojson


def export_geojson_from_csv(csv_in: str | Path, geojson_out: str | Path) -> None:
    df = pd.read_csv(csv_in)
    properties = [c for c in df.columns if c not in ["lat_jitter", "lon_jitter"]]
    geojson_dict = df_to_geojson(df, properties, lat="lat_jitter", lon="lon_jitter")
    geojson_out = Path(geojson_out)
    geojson_out.parent.mkdir(parents=True, exist_ok=True)
    with open(geojson_out, "w", encoding="utf-8") as f:
        json.dump(geojson_dict, f, ensure_ascii=False, indent=2)
