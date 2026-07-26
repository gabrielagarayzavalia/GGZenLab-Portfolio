import { ObjectId } from "mongodb";
import type { JobMatch } from "../types.js";
import { getDb } from "./client.js";

export interface JobDoc extends JobMatch {
  runId?: ObjectId;
  scrapedAt: string;
  updatedAt: Date;
}

export interface ListJobsOptions {
  sort?: string;
  order?: "asc" | "desc";
}

export async function upsertJobs(jobs: JobMatch[], runId: ObjectId, scrapedAt: string): Promise<number> {
  const db = getDb();
  const now = new Date();
  let upserted = 0;

  for (const job of jobs) {
    const doc: JobDoc = {
      ...job,
      runId,
      scrapedAt,
      updatedAt: now,
    };
    const result = await db.collection<JobDoc>("jobs").updateOne(
      { url: job.url },
      { $set: doc },
      { upsert: true }
    );
    if (result.upsertedCount > 0 || result.modifiedCount > 0) upserted++;
  }

  return upserted;
}

const JOB_PROJECTION = { _id: 0, runId: 0, updatedAt: 0, scrapedAt: 0 } as const;

function stripJobDoc(doc: JobDoc): JobMatch {
  const { runId: _runId, scrapedAt: _scrapedAt, updatedAt: _updatedAt, ...job } = doc;
  return job;
}

export async function listJobs(options: ListJobsOptions = {}): Promise<JobMatch[]> {
  const db = getDb();
  const sortField = options.sort === "matchPercent" ? "matchPercent" : "matchPercent";
  const sortDir = options.order === "asc" ? 1 : -1;

  const docs = await db
    .collection<JobDoc>("jobs")
    .find({}, { projection: JOB_PROJECTION })
    .sort({ [sortField]: sortDir })
    .toArray();

  return docs.map(stripJobDoc);
}

export async function findJobsByUrls(urls: string[]): Promise<Map<string, JobMatch>> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (!unique.length) return new Map();

  const db = getDb();
  const docs = await db
    .collection<JobDoc>("jobs")
    .find({ url: { $in: unique } }, { projection: JOB_PROJECTION })
    .toArray();

  return new Map(docs.map((doc) => [doc.url, stripJobDoc(doc)]));
}

export async function findJobsByIds(ids: string[]): Promise<Map<string, JobMatch>> {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();

  const db = getDb();
  const docs = await db
    .collection<JobDoc>("jobs")
    .find({ id: { $in: unique } }, { projection: JOB_PROJECTION })
    .toArray();

  return new Map(docs.map((doc) => [doc.id, stripJobDoc(doc)]));
}
