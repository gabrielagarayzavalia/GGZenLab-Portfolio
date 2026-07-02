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

export async function listJobs(options: ListJobsOptions = {}): Promise<JobMatch[]> {
  const db = getDb();
  const sortField = options.sort === "matchPercent" ? "matchPercent" : "matchPercent";
  const sortDir = options.order === "asc" ? 1 : -1;

  const docs = await db
    .collection<JobDoc>("jobs")
    .find({}, { projection: { _id: 0, runId: 0, updatedAt: 0, scrapedAt: 0 } })
    .sort({ [sortField]: sortDir })
    .toArray();

  return docs as JobMatch[];
}
