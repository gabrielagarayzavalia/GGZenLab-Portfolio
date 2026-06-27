"""Utilidades geográficas: jitter radial y exportación GeoJSON."""

from __future__ import annotations

import json
import math
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

PROVINCIA_MAP = {
    "Tierra del Fuego": "Tierra del Fuego, Antártida e Islas del Atlántico Sur",
}


def normalize_provincia(name: str) -> str:
    if pd.isna(name):
        return name
    return PROVINCIA_MAP.get(str(name), str(name))


def _walk_coords(coords: Any, lons: list[float], lats: list[float]) -> None:
    if isinstance(coords[0], (int, float)):
        lons.append(float(coords[0]))
        lats.append(float(coords[1]))
        return
    for part in coords:
        _walk_coords(part, lons, lats)


def compute_map_viewport(
    geojson: dict,
    *,
    mainland_lon_min: float = -74.5,
    mainland_lon_max: float = -52.5,
    mainland_lat_min: float = -56.0,
    chile_padding_deg: float = 3.0,
    atlantic_padding_deg: float = 6.0,
    lat_padding_deg: float = 1.5,
    map_aspect_wh: float = 1.45,
    lon_cap: tuple[float, float] = (-79.0, -44.0),
) -> tuple[list[float], list[float]]:
    """Lon/lat ranges with Chile + Atlantic margin and aspect ratio for wide map panels."""
    lons: list[float] = []
    lats: list[float] = []
    for feature in geojson["features"]:
        _walk_coords(feature["geometry"]["coordinates"], lons, lats)

    mainland = [
        (lon, lat)
        for lon, lat in zip(lons, lats)
        if mainland_lat_min <= lat and mainland_lon_min <= lon <= mainland_lon_max
    ]
    if not mainland:
        return [-77.0, -46.0], [-56.5, -21.0]

    land_lon_min = min(lon for lon, _lat in mainland)
    land_lon_max = max(lon for lon, _lat in mainland)
    land_lat_min = min(lat for _lon, lat in mainland)
    land_lat_max = max(lat for _lon, lat in mainland)
    land_lon_center = (land_lon_min + land_lon_max) / 2

    lon_min = land_lon_min - chile_padding_deg
    lon_max = land_lon_max + atlantic_padding_deg
    lat_min = land_lat_min - lat_padding_deg
    lat_max = land_lat_max + lat_padding_deg

    center_lat = (lat_min + lat_max) / 2
    lat_span = lat_max - lat_min
    lon_span = lon_max - lon_min
    lon_span_target = lat_span * map_aspect_wh / math.cos(math.radians(center_lat))

    if lon_span < lon_span_target:
        half = lon_span_target / 2
        lon_min = land_lon_center - half
        lon_max = land_lon_center + half

    cap_west, cap_east = lon_cap
    lon_min = max(lon_min, cap_west)
    lon_max = min(lon_max, cap_east)

    return [lon_min, lon_max], [lat_min, lat_max]


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
