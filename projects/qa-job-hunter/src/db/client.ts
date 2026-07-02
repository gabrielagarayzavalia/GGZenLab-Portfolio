import { MongoClient, type Db } from "mongodb";

const DEFAULT_URI = "mongodb://localhost:27017/qa_job_hunter";

let client: MongoClient | null = null;
let db: Db | null = null;

export function getMongoUri(): string {
  return process.env.MONGODB_URI ?? DEFAULT_URI;
}

export async function connect(): Promise<Db> {
  if (db) return db;

  client = new MongoClient(getMongoUri());
  await client.connect();
  db = client.db();
  return db;
}

export function getDb(): Db {
  if (!db) {
    throw new Error("MongoDB not connected. Call connect() first.");
  }
  return db;
}

export async function disconnect(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    db = null;
  }
}
