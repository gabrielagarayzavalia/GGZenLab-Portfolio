"""Descarga el GeoJSON oficial de provincias desde Georef."""

from __future__ import annotations

import sys
from pathlib import Path

import requests

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_FILE = PROJECT_ROOT / "data" / "provincias.geojson"
GEOREF_URL = "https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson"


def main() -> None:
    print(f"Descargando {GEOREF_URL} ...")
    response = requests.get(GEOREF_URL, timeout=120)
    response.raise_for_status()

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_FILE.write_bytes(response.content)

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    print(f"Guardado en: {OUTPUT_FILE} ({size_kb:.1f} KB)")


if __name__ == "__main__":
    try:
        main()
    except requests.RequestException as exc:
        print(f"Error al descargar GeoJSON: {exc}", file=sys.stderr)
        sys.exit(1)
