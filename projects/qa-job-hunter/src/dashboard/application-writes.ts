import type { ApplicationStatus } from "../application-status.js";
<<<<<<< HEAD
import {
  gmailAssessmentDoneProximoPaso,
  gmailAssessmentPendingProximoPaso,
  hasGmailAssessmentPendingSignal,
} from "../tracker/gmail-assessment-label.js";
import type { TrackerApplication, TrackerApplicationPatch } from "../types/tracker-application.js";
=======
import type { TrackerApplication, TrackerApplicationPatch } from "../types/tracker-application.js";

>>>>>>> origin/main
export type DashboardApplicationPatch = TrackerApplicationPatch & {
  matchRejected?: boolean;
  matchRejectedReason?: string;
  matchRejectedAt?: string;
};

const NOTA_NO_APLICADO = "No aplicado (dashboard)";
const NOTA_NO_SELECCIONADA = "No seleccionada/o (dashboard)";
<<<<<<< HEAD
const NOTA_ASSESSMENT_PENDIENTE = "Assessment pendiente (dashboard)";
const NOTA_ASSESSMENT_REALIZADO = "Assessment realizado (dashboard)";
const NOTA_REJECT = "Match incorrecto (dashboard)";
const NOTA_DESMARCAR = "Desmarcado (dashboard)";
/** Precondición PO #420: solo después de aplicar o legacy A-pendiente. */
const ASSESSMENT_PRECONDITION_ESTADOS: TrackerApplication["estado"][] = [
  "Enviada",
  "Borrador abierto",
  "A-pendiente",
];

export function canMarkAssessmentPending(existing: TrackerApplication): boolean {
  return ASSESSMENT_PRECONDITION_ESTADOS.includes(existing.estado);
}
=======
const NOTA_REJECT = "Match incorrecto (dashboard)";
const NOTA_DESMARCAR = "Desmarcado (dashboard)";
>>>>>>> origin/main

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
    // Acción explícita usuaria — mismo criterio que PATCH en /tracker (source=user).
<<<<<<< HEAD
    if (existing.estado === "A-realizado") {
      return {
        patch: {},
        error: "No se puede desmarcar A-realizado desde el dashboard",
      };
    }
    if (existing.estado === "A-pendiente") {
      const hasApplied = Boolean(existing.fechaAplicacion?.trim());
      return {
        patch: {
          estado: hasApplied ? "Enviada" : "Pendiente",
          notas: appendNota(existing.notas, NOTA_DESMARCAR),
        },
      };
    }
=======
>>>>>>> origin/main
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
<<<<<<< HEAD
    case "assessment_pending": {
      if (existing.estado === "A-realizado") {
        return {
          patch: {},
          error: "No se puede volver a A-pendiente desde A-realizado",
        };
      }
      if (!canMarkAssessmentPending(existing)) {
        return {
          patch: {},
          error:
            "Assessment pendiente solo después de aplicar (Enviada, Borrador abierto o assessment previo)",
        };
      }
      if (!hasGmailAssessmentPendingSignal(existing)) {
        return {
          patch: {},
          error:
            "Assessment pendiente requiere mail en Gmail Entrevistas-Assessments/Pendientes",
        };
      }
      return {
        patch: {
          estado: "A-pendiente",
          proximoPaso: gmailAssessmentPendingProximoPaso(),
          notas: appendNota(existing.notas, NOTA_ASSESSMENT_PENDIENTE),
        },
      };
    }
    case "assessment_done": {
      if (existing.estado !== "A-pendiente") {
        return {
          patch: {},
          error: "Assessment realizado solo desde A-pendiente",
        };
      }
      return {
        patch: {
          estado: "A-realizado",
          proximoPaso: gmailAssessmentDoneProximoPaso(),
          notas: appendNota(existing.notas, NOTA_ASSESSMENT_REALIZADO),
        },
      };
    }
=======
>>>>>>> origin/main
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
  const patch: DashboardApplicationPatch = { matchRejected: false };
  if (existing.estado === "Stand-by" && existing.matchRejected) {
    patch.estado = "Pendiente";
  }
  return patch;
}
