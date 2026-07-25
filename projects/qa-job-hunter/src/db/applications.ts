import { ObjectId } from "mongodb";
import type {
  TrackerApplication,
  TrackerApplicationPatch,
  TrackerEstado,
} from "../types/tracker-application.js";
import { applyTrackerPatch, type TrackerWriteSource } from "../tracker/estado-policy.js";
import { extractJobId, normalizeLinkedInUrl } from "../tracker/linkedin-url.js";
import {
  pipelineMatchToApplicationInput,
  type PipelineMatchResult,
} from "../tracker/pipeline-match.js";
import { isProtectedEstado } from "../tracker/protected-estado.js";
import { getDb } from "./client.js";

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
}

export interface UpsertApplicationInput
  extends Omit<TrackerApplication, "id" | "createdAt" | "updatedAt"> {}

function toApi(doc: ApplicationDoc): TrackerApplication {
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
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
    updatedBy: doc.updatedBy,
  };
}

function buildDocFields(
  input: UpsertApplicationInput,
  now: Date
): Omit<ApplicationDoc, "_id"> {
  const linkedinUrl = input.linkedinUrl ?? "";
  const linkedinUrlNorm = normalizeLinkedInUrl(linkedinUrl);
  return {
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
}

export async function listApplications(
  options: ListApplicationsOptions = {}
): Promise<TrackerApplication[]> {
  const db = getDb();
  const filter: Record<string, unknown> = {};

  if (options.estado) {
    filter.estado = options.estado;
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
): Promise<{ upserted: number; modified: number }> {
  const db = getDb();
  let upserted = 0;
  let modified = 0;
  const now = new Date();

  for (const input of inputs) {
    const { patch } = applyTrackerPatch(input, source === "import" ? "import" : source);
    const merged = { ...input, ...patch };
    const fields = buildDocFields(merged, now);
    const { createdAt, ...setFields } = fields;
    const filter =
      fields.linkedinUrlNorm
        ? { linkedinUrlNorm: fields.linkedinUrlNorm }
        : fields.jobId
          ? { jobId: fields.jobId }
          : {
              puesto: fields.puesto,
              empresa: fields.empresa,
            };

    const result = await db.collection<ApplicationDoc>("applications").updateOne(
      filter,
      {
        $set: { ...setFields, updatedAt: now },
        $setOnInsert: { createdAt: now },
      },
      { upsert: true }
    );

    if (result.upsertedCount > 0) upserted++;
    else if (result.modifiedCount > 0) modified++;
  }

  return { upserted, modified };
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
 * Espeja lógica excel/upsert: insert Pendiente; update solo si estado no protegido.
 */
export async function upsertPipelineMatches(
  matches: PipelineMatchResult[]
): Promise<PipelineUpsertResult> {
  const db = getDb();
  const col = db.collection<ApplicationDoc>("applications");
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date();

  for (const match of matches) {
    const input = pipelineMatchToApplicationInput(match);
    const fields = buildDocFields(input, now);
    const filter = applicationFilter(fields);

    const existing = await col.findOne(filter);

    if (!existing) {
      await col.insertOne({
        _id: new ObjectId(),
        ...fields,
        createdAt: now,
        updatedAt: now,
      });
      inserted++;
      continue;
    }

    if (isProtectedEstado(existing.estado)) {
      skipped++;
      continue;
    }

    const update: Partial<ApplicationDoc> = {
      matchPercent: fields.matchPercent,
      puesto: fields.puesto,
      empresa: fields.empresa,
      linkedinUrl: fields.linkedinUrl,
      linkedinUrlNorm: fields.linkedinUrlNorm,
      jobId: fields.jobId,
      gmailId: fields.gmailId ?? existing.gmailId,
      canal: fields.canal,
      cvType: fields.cvType ?? existing.cvType,
      applyType: fields.applyType ?? existing.applyType,
      proximoPaso: existing.proximoPaso?.trim()
        ? existing.proximoPaso
        : fields.proximoPaso,
      updatedAt: now,
      updatedBy: "pipeline",
    };

    if (!existing.estado?.trim()) {
      update.estado = "Pendiente";
    }

    const result = await col.updateOne({ _id: existing._id }, { $set: update });
    if (result.modifiedCount > 0) updated++;
    else skipped++;
  }

  return { inserted, updated, skipped };
}
