/**
 * Spike B38 — Schema canónico Application (web-first tracker).
 * Fuente de verdad futura: colección Mongo `applications`.
 * Mapeo 1:1 con columnas Empleos_Tracker.xlsx + hoja meta.
 */

/** Estados del tracker (columna Estado en Excel). Descartado: solo usuaria. */
export type TrackerEstado =
  | "Pendiente"
  | "Stand-by"
  | "Enviada"
  | "Borrador abierto"
  | "A-pendiente"
  | "A-realizado"
  | "Cerrado"
  | "Duplicado"
  | "Descartado";

export type TrackerCanal = "Easy Apply" | "Externo" | "—" | string;

/** Documento canónico en Mongo `applications`. */
export interface TrackerApplication {
  /** ObjectId string en API; jobId LinkedIn cuando existe. */
  id: string;
  jobId?: string;
  gmailId?: string;

  matchPercent: number;
  puesto: string;
  empresa: string;
  linkedinUrl: string;
  canal: TrackerCanal;
  estado: TrackerEstado;
  fechaAplicacion?: string;
  portalExterno?: string;
  proximoPaso?: string;
  /** Automatización + hints del bot. Nunca pisa misComentarios. */
  notas?: string;
  /** Solo usuaria (#168 B26). */
  misComentarios?: string;

  cvType?: string;
  applyType?: string;

  createdAt: string;
  updatedAt: string;
  /** Origen del último write: pipeline | easy-apply | reconcile | user | import */
  updatedBy?: string;
}

/** Payload parcial para PATCH (celda editada en grilla). */
export type TrackerApplicationPatch = Partial<
  Pick<
    TrackerApplication,
    | "estado"
    | "notas"
    | "misComentarios"
    | "proximoPaso"
    | "portalExterno"
    | "fechaAplicacion"
    | "canal"
    | "puesto"
    | "empresa"
    | "matchPercent"
  >
>;

export const TRACKER_ESTADO_VALUES: TrackerEstado[] = [
  "Pendiente",
  "Stand-by",
  "Enviada",
  "Borrador abierto",
  "A-pendiente",
  "A-realizado",
  "Cerrado",
  "Duplicado",
  "Descartado",
];

/** Columnas visibles en grilla desktop (orden Excel). */
export const TRACKER_GRID_COLUMNS = [
  "matchPercent",
  "puesto",
  "empresa",
  "linkedinUrl",
  "canal",
  "estado",
  "fechaAplicacion",
  "portalExterno",
  "proximoPaso",
  "notas",
  "misComentarios",
] as const;
