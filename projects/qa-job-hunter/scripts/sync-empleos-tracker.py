#!/usr/bin/env python3
"""Sync Empleos_Tracker.xlsx <-> output/apply/apply-queue.csv

  python scripts/sync-empleos-tracker.py import   # Excel Easy Apply+Pendiente → cola
  python scripts/sync-empleos-tracker.py export   # cola → Excel Estado
"""

from __future__ import annotations

import csv
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import openpyxl
except ImportError:
    print("Instalá openpyxl: pip install openpyxl")
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
QUEUE_PATH = ROOT / "output" / "apply" / "apply-queue.csv"
DEFAULT_XLSX = Path(r"C:\Users\gabri\OneDrive\Escritorio\Empleos_Tracker.xlsx")

JOB_ID_RE = re.compile(r"(?:currentJobId=|/jobs/view/)(\d+)")

# Cola → Excel
STATUS_TO_EXCEL = {
    "pendiente": "Pendiente",
    "enviada": "Enviada",
    "cerrada": "Cerrado",
    "descartada": "Descartado",
}

# Excel → cola (solo lectura de finales / pendiente)
EXCEL_TO_STATUS = {
    "pendiente": "pendiente",
    "enviada": "enviada",
    "cerrado": "cerrada",
    "descartado": "descartada",
    "stand-by": "pendiente",  # no final para la cola; no lo pisamos al export si quedó stand-by
    "borrador abierto": "pendiente",
}


def job_id_from_url(url: str) -> str:
    m = JOB_ID_RE.search(url or "")
    return m.group(1) if m else ""


def match_percent(raw) -> int:
    if raw is None:
        return 0
    s = str(raw).strip().replace("%", "")
    try:
        return int(float(s))
    except ValueError:
        return 0


def cmd_import(xlsx: Path) -> None:
    wb = openpyxl.load_workbook(xlsx, read_only=True, data_only=True)
    ws = wb["Empleos"]
    rows = []
    for r in ws.iter_rows(min_row=2, values_only=True):
        if not r or not r[3]:
            continue
        canal = (r[4] or "").strip()
        estado = (r[5] or "").strip()
        if canal.lower() != "easy apply":
            continue
        if estado.lower() != "pendiente":
            continue
        url = str(r[3]).strip()
        jid = job_id_from_url(url)
        if not jid:
            continue
        rows.append(
            {
                "jobId": jid,
                "matchPercent": match_percent(r[0]),
                "title": (r[1] or "").strip(),
                "company": (r[2] or "").strip(),
                "url": f"https://www.linkedin.com/jobs/view/{jid}/",
                "easyApply": "yes",
                "status": "pendiente",
                "reason": "Importado desde Empleos_Tracker.xlsx",
                "updatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            }
        )
    rows.sort(key=lambda x: -x["matchPercent"])
    QUEUE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with QUEUE_PATH.open("w", encoding="utf-8", newline="") as f:
        w = csv.writer(f, delimiter=";")
        w.writerow(
            [
                "JobId",
                "Match%",
                "Title",
                "Company",
                "URL",
                "EasyApply",
                "ApplyStatus",
                "Reason",
                "UpdatedAt",
            ]
        )
        for r in rows:
            w.writerow(
                [
                    r["jobId"],
                    r["matchPercent"],
                    r["title"],
                    r["company"],
                    r["url"],
                    r["easyApply"],
                    r["status"],
                    r["reason"],
                    r["updatedAt"],
                ]
            )
    print(f"Import OK: {len(rows)} Easy Apply + Pendiente → {QUEUE_PATH}")


def load_queue() -> dict[str, dict]:
    if not QUEUE_PATH.exists():
        return {}
    by_id = {}
    with QUEUE_PATH.open(encoding="utf-8") as f:
        reader = csv.DictReader(f, delimiter=";")
        for row in reader:
            jid = (row.get("JobId") or "").strip()
            if jid:
                by_id[jid] = row
    return by_id


def cmd_export(xlsx: Path) -> None:
    queue = load_queue()
    if not queue:
        print("Cola vacía; nada que exportar.")
        return

    wb = openpyxl.load_workbook(xlsx)
    ws = wb["Empleos"]
    # headers row 1
    updated = 0
    skipped_final = 0
    for row_idx in range(2, ws.max_row + 1):
        url = ws.cell(row_idx, 4).value  # LinkedIn
        jid = job_id_from_url(str(url or ""))
        if not jid or jid not in queue:
            continue
        current = (ws.cell(row_idx, 6).value or "").strip()  # Estado
        # No pisar finales del Excel ni Stand-by
        if current.lower() in ("cerrado", "descartado", "stand-by"):
            skipped_final += 1
            continue
        status = (queue[jid].get("ApplyStatus") or "pendiente").strip().lower()
        excel_estado = STATUS_TO_EXCEL.get(status)
        if not excel_estado:
            continue
        if current == excel_estado:
            continue
        ws.cell(row_idx, 6).value = excel_estado
        # Fecha Aplicación si enviada
        if excel_estado == "Enviada" and not ws.cell(row_idx, 7).value:
            ws.cell(row_idx, 7).value = datetime.now().strftime("%Y-%m-%d")
        updated += 1

    wb.save(xlsx)
    print(f"Export OK: {updated} filas actualizadas en {xlsx} (omitidas finales/stand-by: {skipped_final})")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] not in ("import", "export"):
        print(__doc__)
        sys.exit(1)
    xlsx = Path(sys.argv[2]) if len(sys.argv) > 2 else DEFAULT_XLSX
    if not xlsx.exists():
        print(f"No existe: {xlsx}")
        sys.exit(1)
    if sys.argv[1] == "import":
        cmd_import(xlsx)
    else:
        cmd_export(xlsx)


if __name__ == "__main__":
    main()
