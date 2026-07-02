import { ObjectId } from "mongodb";
import type { AnalysisResult } from "../types.js";
import { getDb } from "./client.js";

export interface AnalysisRunDoc {
  _id?: ObjectId;
  scrapedAt: string;
  totalFound: number;
  totalAnalyzed: number;
  provider?: string;
  createdAt: Date;
}

export async function saveRun(result: AnalysisResult, provider?: string): Promise<ObjectId> {
  const db = getDb();
  const doc: AnalysisRunDoc = {
    scrapedAt: result.scrapedAt,
    totalFound: result.totalFound,
    totalAnalyzed: result.totalAnalyzed,
    provider,
    createdAt: new Date(),
  };
  const inserted = await db.collection<AnalysisRunDoc>("analysis_runs").insertOne(doc);
  return inserted.insertedId;
}
