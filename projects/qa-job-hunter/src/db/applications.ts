import { ObjectId } from "mongodb";
import type {
  TrackerApplication,
  TrackerApplicationPatch,
  TrackerEstado,
} from "../types/tracker-application.js";
import type { AnalysisSnapshot } from "../types/dashboard-match.js";
import { normalizeFeedbackFields } from "../types/dashboard-match.js";
import { applyTrackerPatch, type TrackerWriteSource } from "../tracker/estado-policy.js";
import { extractJobId, normalizeLinkedInUrl } from "../tracker/linkedin-url.js";
import {
  pipelineMatchToApplicationInput,
  type PipelineMatchResult,
  type PipelineScrapedJob,
} from "../tracker/pipeline-match.js";
import { queueRowToApplicationFields } from "../tracker/apply-queue-map.js";
import type { QueueRow } from "../apply/apply-queue.js";
import { planAutomationUpsert, planEasyApplyUpsert } from "../tracker/automation-merge.js";
import { DASHBOARD_MIN_MATCH } from "../tracker/pipeline-match.js";
import { isProtectedEstado } from "../tracker/protected-estado.js";
import { getDb } from "./client.js";

const DASHBOARD_HIDDEN_ESTADOS: TrackerEstado[] = ["Duplicado", "Descartado"];
const DASHBOARD_HISTORICAL_ESTADOS: TrackerEstado[] = [
  "Enviada",
  "A-realizado",
  "Borrador abierto",
  "Cerrado",
  "Stand-by",
];

export interface ApplicationDoc {
  _id: ObjectId;
  jobId?: string;
  gmailId?: string;
  matchPercent: number;
  puesto: string;
  empresa: string;
  linkedinUrl: string;
  linkedinUrlNorm: string;
  canal: string;
  estado: TrackerEstado;
  fechaAplicacion?: string;
  portalExterno?: string;
  proximoPaso?: string;
  notas?: string;
  misComentarios?: string;
  cvType?: string;
  applyType?: string;
  analysis?: AnalysisSnapshot;
  matchRejected?: boolean;
  matchRejectedReason?: string;
  matchRejectedAt?: string;
  inLatestAnalysis?: boolean;
  createdAt: Date;
  updatedAt: Date;
  updatedBy?: string;
}

export interface ListApplicationsOptions {
  estado?: string;
  q?: string;
  sort?: "matchPercent" | "updatedAt" | "estado";
  order?: "asc" | "desc";
  limit?: number;
  /** Filtro dashboard B-38-13 (#311). */
  matchRejected?: boolean;
  inLatestAnalysis?: boolean;
  minMatchPercent?: number;
}

export interface UpsertApplicationInput
  extends Omit<TrackerApplication, "id" | "createdAt" | "updatedAt"> {}

function toApi(doc: ApplicationDoc): TrackerApplication {
  const feedback = normalizeFeedbackFields({
    matchRejected: doc.matchRejected,
    matchRejectedReason: doc.matchRejectedReason,
    matchRejectedAt: doc.matchRejectedAt,
    inLatestAnalysis: doc.inLatestAnalysis,
  });
  return {
    id: doc._id.toHexString(),
    jobId: doc.jobId,
    gmailId: doc.gmailId,
    matchPercent: doc.matchPercent,
    puesto: doc.puesto,
    empresa: doc.empresa,
    linkedinUrl: doc.linkedinUrl,
    canal: doc.canal,
    estado: doc.estado,
    fechaAplicacion: doc.fechaAplicacion,
    portalExterno: doc.portalExterno,
    proximoPaso: doc.proximoPaso,
    notas: doc.notas,
    misComentarios: doc.misComentarios,
    cvType: doc.cvType,
    applyType: doc.applyType,
    analysis: doc.analysis,
    ...feedback,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    updatedBy: doc.updatedBy,
  };
}

/** Expuesto para tests B-38-13. */
export const toTrackerApplication = toApi;

function appendB38Fields(
  target: Omit<ApplicationDoc, "_id">,
  input: UpsertApplicationInput
): void {
  if (input.analysis !== undefined) target.analysis = input.analysis;
  if (input.matchRejected !== undefined) target.matchRejected = input.matchRejected;
  if (input.matchRejectedReason !== undefined) {
    target.matchRejectedReason = input.matchRejectedReason;
  }
  if (input.matchRejectedAt !== undefined) target.matchRejectedAt = input.matchRejectedAt;
  if (input.inLatestAnalysis !== undefined) target.inLatestAnalysis = input.inLatestAnalysis;
}

function buildDocFields(
  input: UpsertApplicationInput,
  now: Date
): Omit<ApplicationDoc, "_id"> {
  const linkedinUrl = input.linkedinUrl ?? "";
  const linkedinUrlNorm = normalizeLinkedInUrl(linkedinUrl);
  const doc: Omit<ApplicationDoc, "_id"> = {
    jobId: input.jobId ?? extractJobId(linkedinUrl),
    gmailId: input.gmailId,
    matchPercent: input.matchPercent ?? 0,
    puesto: input.puesto ?? "",
    empresa: input.empresa ?? "",
    linkedinUrl,
    linkedinUrlNorm,
    canal: input.canal ?? "—",
    estado: input.estado ?? "Pendiente",
    fechaAplicacion: input.fechaAplicacion,
    portalExterno: input.portalExterno,
    proximoPaso: input.proximoPaso,
    notas: input.notas,
    misComentarios: input.misComentarios,
    cvType: input.cvType,
    applyType: input.applyType,
    createdAt: now,
    updatedAt: now,
    updatedBy: input.updatedBy,
  };
  appendB38Fields(doc, input);
  return doc;
}

/**
 * Applications visibles en dashboard match-jobs (#311):
 * match≥70 en última corrida, feedback reject o estado de postulación histórico.
 */
export async function listDashboardMatchApplications(): Promise<TrackerApplication[]> {
  const db = getDb();
  const docs = await db
    .collection<ApplicationDoc>("applications")
    .find({
      estado: { $nin: DASHBOARD_HIDDEN_ESTADOS },
      $or: [
        { matchPercent: { $gte: DASHBOARD_MIN_MATCH } },
        { matchRejected: true },
        { estado: { $in: DASHBOARD_HISTORICAL_ESTADOS } },
      ],
    })
    .sort({ matchPercent: -1 })
    .limit(5000)
    .toArray();

  return docs.map(toApi);
}

export async function listApplications(
  options: ListApplicationsOptions = {}
): Promise<TrackerApplication[]> {
  const db = getDb();
  const filter: Record<string, unknown> = {};

  if (options.estado) {
    filter.estado = options.estado;
  }
  if (options.matchRejected !== undefined) {
    filter.matchRejected = options.matchRejected;
  }
  if (options.inLatestAnalysis !== undefined) {
    filter.inLatestAnalysis = options.inLatestAnalysis;
  }
  if (options.minMatchPercent != null && Number.isFinite(options.minMatchPercent)) {
    filter.matchPercent = { $gte: options.minMatchPercent };
  }
  if (options.q?.trim()) {
    const q = options.q.trim();
    filter.$or = [
      { puesto: { $regex: q, $options: "i" } },
      { empresa: { $regex: q, $options: "i" } },
      { notas: { $regex: q, $options: "i" } },
    ];
  }

  const sortField =
    options.sort === "updatedAt"
      ? "updatedAt"
      : options.sort === "estado"
        ? "estado"
        : "matchPercent";
  const sortDir = options.order === "asc" ? 1 : -1;
  const limit = options.limit && options.limit > 0 ? options.limit : 5000;

  const docs = await db
    .collection<ApplicationDoc>("applications")
    .find(filter)
    .sort({ [sortField]: sortDir })
    .limit(limit)
    .toArray();

  return docs.map(toApi);
}

export async function getApplicationById(id: string): Promise<TrackerApplication | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const doc = await db.collection<ApplicationDoc>("applications").findOne({
    _id: new ObjectId(id),
  });
  return doc ? toApi(doc) : null;
}

export async function createApplication(
  input: UpsertApplicationInput,
  source: TrackerWriteSource = "user"
): Promise<TrackerApplication> {
  const { patch } = applyTrackerPatch(input, source === "import" ? "import" : source);
  const now = new Date();
  const doc = buildDocFields({ ...input, ...patch }, now);
  const db = getDb();
  const result = await db.collection<ApplicationDoc>("applications").insertOne({
    _id: new ObjectId(),
    ...doc,
  });
  const saved = await db.collection<ApplicationDoc>("applications").findOne({
    _id: result.insertedId,
  });
  if (!saved) throw new Error("No se pudo leer application recién creada");
  return toApi(saved);
}

export async function patchApplication(
  id: string,
  patch: TrackerApplicationPatch,
  source: TrackerWriteSource
): Promise<{ application: TrackerApplication; warnings: string[] } | null> {
  if (!ObjectId.isValid(id)) return null;
  const db = getDb();
  const existing = await db.collection<ApplicationDoc>("applications").findOne({
    _id: new ObjectId(id),
  });
  if (!existing) return null;

  const { patch: safePatch, warnings } = applyTrackerPatch(patch, source);
  if (!Object.keys(safePatch).length) {
    return { application: toApi(existing), warnings };
  }

  const now = new Date();
  const update: Partial<ApplicationDoc> = {
    ...safePatch,
    updatedAt: now,
    updatedBy: source === "user" ? "user" : source,
  };

  if (safePatch.linkedinUrl != null) {
    update.linkedinUrlNorm = normalizeLinkedInUrl(safePatch.linkedinUrl);
    update.jobId = extractJobId(safePatch.linkedinUrl);
  }

  await db.collection<ApplicationDoc>("applications").updateOne(
    { _id: existing._id },
    { $set: update }
  );

  const saved = await db.collection<ApplicationDoc>("applications").findOne({
    _id: existing._id,
  });
  if (!saved) return null;
  return { application: toApi(saved), warnings };
}

export async function upsertApplicationsBulk(
  inputs: UpsertApplicationInput[],
  source: TrackerWriteSource = "import"
): Promise<{ upserted: number; modified: number; skipped: number }> {
  const db = getDb();
  const col = db.collection<ApplicationDoc>("applications");
  let upserted = 0;
  let modified = 0;
  let skipped = 0;
  const now = new Date();

  for (const input of inputs) {
    const { patch } = applyTrackerPatch(input, source === "import" ? "import" : source);
    const merged = { ...input, ...patch };
    const fields = buildDocFields(merged, now);
    const filter = applicationFilter(fields);

    const existing = await col.findOne(filter);
    if (existing && isProtectedEstado(existing.estado) && source !== "user") {
      skipped++;
      continue;
    }

    if (!existing) {
      await col.insertOne({
        _id: new ObjectId(),
        ...fields,
        createdAt: now,
        updatedAt: now,
      });
      upserted++;
      continue;
    }

    const { createdAt, estado, ...setFields } = fields;
    const update: Partial<ApplicationDoc> = {
      ...setFields,
      updatedAt: now,
      updatedBy: source === "import" ? "import" : source,
    };
    if (!existing.estado?.trim() && estado) {
      update.estado = estado;
    }

    const result = await col.updateOne({ _id: existing._id }, { $set: update });
    if (result.modifiedCount > 0) modified++;
    else skipped++;
  }

  return { upserted, modified, skipped };
}

export async function countApplications(): Promise<number> {
  const db = getDb();
  return db.collection("applications").countDocuments();
}

export interface PipelineUpsertResult {
  inserted: number;
  updated: number;
  skipped: number;
}

function applicationFilter(fields: ReturnType<typeof buildDocFields>) {
  if (fields.linkedinUrlNorm) return { linkedinUrlNorm: fields.linkedinUrlNorm };
  if (fields.jobId) return { jobId: fields.jobId };
  return { puesto: fields.puesto, empresa: fields.empresa };
}

/**
 * Dual-write pipeline → Mongo (B-38-5).
 * Usa planAutomationUpsert: insert Pendiente; update solo si estado no protegido.
 */
export async function upsertPipelineMatches(
  matches: PipelineMatchResult[],
  scrapedByJobId: Map<string, PipelineScrapedJob> = new Map()
): Promise<PipelineUpsertResult> {
  const db = getDb();
  const col = db.collection<ApplicationDoc>("applications");
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();
  const analyzedAt = now.toISOString();

  for (const match of matches) {
    const scraped = scrapedByJobId.get(match.jobId);
    const input = pipelineMatchToApplicationInput(match, scraped, analyzedAt);
    const fields = buildDocFields(input, now);
    const filter = applicationFilter(fields);

    const existing = await col.findOne(filter);
    const plan = planAutomationUpsert(existing, fields, "pipeline");

    if (plan.action === "skip") {
      skipped++;
      continue;
    }

    if (plan.action === "insert") {
      await col.insertOne({
        _id: new ObjectId(),
        ...plan.fields,
        createdAt: now,
        updatedAt: now,
        updatedBy: "pipeline",
      });
      inserted++;
      continue;
    }

    const result = await col.updateOne(
      { _id: existing!._id },
      { $set: { ...plan.update, updatedAt: now } }
    );
    if (result.modifiedCount > 0) updated++;
    else skipped++;
  }

  return { inserted, updated, skipped };
}

export interface EasyApplyUpsertResult {
  action: "insert" | "update" | "skip";
}

/**
 * Dual-write Easy Apply cola → Mongo (B-38-6).
 * Usa planEasyApplyUpsert: Enviada/notas desde cola; skip estados bloqueados por usuaria.
 */
export async function upsertEasyApplyQueueRow(row: QueueRow): Promise<EasyApplyUpsertResult> {
  const db = getDb();
  const col = db.collection<ApplicationDoc>("applications");
  const now = new Date();
  const input = queueRowToApplicationFields(row);
  const fields = buildDocFields(
    { ...input, updatedBy: "easy-apply" },
    now
  );
  const filter = applicationFilter(fields);

  const existing = await col.findOne(filter);
  const plan = planEasyApplyUpsert(existing, input, "easy-apply");

  if (plan.action === "skip") {
    return { action: "skip" };
  }

  if (plan.action === "insert") {
    const doc = buildDocFields({ ...plan.fields, updatedBy: "easy-apply" }, now);
    await col.insertOne({
      _id: new ObjectId(),
      ...doc,
      createdAt: now,
      updatedAt: now,
      updatedBy: "easy-apply",
    });
    return { action: "insert" };
  }

  const result = await col.updateOne(
    { _id: existing!._id },
    { $set: { ...plan.update, updatedAt: now } }
  );
  return { action: result.modifiedCount > 0 ? "update" : "skip" };
}
