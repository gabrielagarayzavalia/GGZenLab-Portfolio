import type { ApplicationStatus } from "../application-status.js";
import { isProtectedEstado } from "../tracker/protected-estado.js";
import type { TrackerApplication, TrackerApplicationPatch } from "../types/tracker-application.js";

export type DashboardApplicationPatch = TrackerApplicationPatch & {
  matchRejected?: boolean;
  matchRejectedReason?: string;
  matchRejectedAt?: string;
};

const NOTA_NO_APLICADO = "No aplicado (dashboard)";
const NOTA_NO_SELECCIONADA = "No seleccionada/o (dashboard)";
const NOTA_REJECT = "Match incorrecto (dashboard)";
const NOTA_DESMARCAR = "Desmarcado (dashboard)";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function appendNota(existing: string | undefined, line: string): string {
  const base = (existing ?? "").trim();
  if (!base) return line;
  if (base.includes(line)) return base;
  return `${base}\n${line}`;
}

export function patchForApplicationStatus(
  status: ApplicationStatus | null,
  existing: TrackerApplication
): { patch: DashboardApplicationPatch; error?: string } {
  if (status === null) {
    if (isProtectedEstado(existing.estado)) {
      return {
        patch: {},
        error: `Estado protegido (${existing.estado}); no se puede desmarcar desde el dashboard.`,
      };
    }
    return {
      patch: {
        estado: "Pendiente",
        notas: appendNota(existing.notas, NOTA_DESMARCAR),
      },
    };
  }

  switch (status) {
    case "applied":
      return {
        patch: {
          estado: "Enviada",
          fechaAplicacion: todayIsoDate(),
        },
      };
    case "not_applied":
      return {
        patch: {
          estado: "Stand-by",
          notas: appendNota(existing.notas, NOTA_NO_APLICADO),
        },
      };
    case "not_selected":
      return {
        patch: {
          estado: "Cerrado",
          proximoPaso: NOTA_NO_SELECCIONADA,
          notas: appendNota(existing.notas, NOTA_NO_SELECCIONADA),
        },
      };
    default:
      return { patch: {}, error: "Estado de postulación inválido" };
  }
}

export function patchForRejectMatch(
  reason: string | undefined,
  existing: TrackerApplication
): DashboardApplicationPatch {
  const line = reason?.trim()
    ? `${NOTA_REJECT}: ${reason.trim()}`
    : NOTA_REJECT;
  return {
    matchRejected: true,
    matchRejectedReason: reason?.trim() || undefined,
    matchRejectedAt: new Date().toISOString(),
    estado: "Stand-by",
    notas: appendNota(existing.notas, line),
  };
}

export function patchForUndoReject(existing: TrackerApplication): DashboardApplicationPatch {
  const patch: DashboardApplicationPatch = {
    matchRejected: false,
    matchRejectedReason: undefined,
    matchRejectedAt: undefined,
  };
  if (existing.estado === "Stand-by" && existing.matchRejected) {
    patch.estado = "Pendiente";
  }
  return patch;
}
