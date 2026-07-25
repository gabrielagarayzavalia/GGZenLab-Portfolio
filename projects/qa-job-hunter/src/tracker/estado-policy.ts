import type { TrackerApplicationPatch, TrackerEstado } from "../types/tracker-application.js";
import { TRACKER_ESTADO_VALUES } from "../types/tracker-application.js";

export type TrackerWriteSource = "user" | "automation" | "import";

const AUTOMATION_FORBIDDEN = "descartado";

const CANON: Record<string, TrackerEstado> = {
  pendiente: "Pendiente",
  "stand-by": "Stand-by",
  standby: "Stand-by",
  enviada: "Enviada",
  "borrador abierto": "Borrador abierto",
  "a-pendiente": "A-pendiente",
  "a-realizado": "A-realizado",
  cerrado: "Cerrado",
  duplicado: "Duplicado",
  descartado: "Descartado",
};

export function normalizeTrackerEstado(raw: string): TrackerEstado | null {
  const key = (raw ?? "").trim().toLowerCase();
  if (!key) return null;
  return CANON[key] ?? null;
}

/** Automatización nunca escribe Descartado; desconocido → Stand-by. */
export function coerceAutomationEstado(estado: string): {
  estado: TrackerEstado;
  redirectedFromDescartado: boolean;
  unknown: boolean;
} {
  const raw = (estado ?? "").trim();
  const lower = raw.toLowerCase();
  if (!raw) {
    return { estado: "Stand-by", redirectedFromDescartado: false, unknown: true };
  }
  if (lower === AUTOMATION_FORBIDDEN) {
    return { estado: "Stand-by", redirectedFromDescartado: true, unknown: false };
  }
  const normalized = normalizeTrackerEstado(raw);
  if (!normalized || normalized === "Descartado") {
    return { estado: "Stand-by", redirectedFromDescartado: false, unknown: true };
  }
  return { estado: normalized, redirectedFromDescartado: false, unknown: false };
}

const USER_ONLY_FIELDS = new Set(["misComentarios"]);

export function applyTrackerPatch(
  patch: TrackerApplicationPatch,
  source: TrackerWriteSource
): { patch: TrackerApplicationPatch; warnings: string[] } {
  const out: TrackerApplicationPatch = { ...patch };
  const warnings: string[] = [];

  if (source === "automation") {
    if ("misComentarios" in out) {
      delete out.misComentarios;
      warnings.push("misComentarios ignorado (solo usuaria)");
    }
    if (out.estado != null) {
      const coerced = coerceAutomationEstado(out.estado);
      if (coerced.redirectedFromDescartado) {
        warnings.push("Descartado redirigido a Stand-by (solo usuaria puede Descartado)");
      }
      if (coerced.unknown && out.estado.trim()) {
        warnings.push(`Estado desconocido "${out.estado}" → Stand-by`);
      }
      out.estado = coerced.estado;
      if (coerced.unknown || coerced.redirectedFromDescartado) {
        const hint = coerced.redirectedFromDescartado
          ? "Automatización no puede setear Descartado."
          : `Estado no reconocido: ${out.estado}`;
        out.notas = appendNota(out.notas, hint);
      }
    }
  } else if (source === "import") {
    if (out.estado != null) {
      const normalized = normalizeTrackerEstado(String(out.estado));
      if (normalized) out.estado = normalized;
    }
  } else if (out.estado != null) {
    const normalized = normalizeTrackerEstado(String(out.estado));
    if (!normalized) {
      throw new Error(
        `Estado inválido: "${out.estado}". Valores: ${TRACKER_ESTADO_VALUES.join(", ")}`
      );
    }
    out.estado = normalized;
  }

  if (source === "automation") {
    for (const key of USER_ONLY_FIELDS) {
      if (key in out) delete (out as Record<string, unknown>)[key];
    }
  }

  return { patch: out, warnings };
}

function appendNota(existing: string | undefined, line: string): string {
  const base = (existing ?? "").trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`;
}
