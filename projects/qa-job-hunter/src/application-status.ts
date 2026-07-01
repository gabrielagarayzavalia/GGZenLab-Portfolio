// ============================================================
//  application-status.ts — Estados de postulación por empleo
// ============================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const APPLICATION_STATUS_PATH = path.join(ROOT, "output", "application-status.json");

export type ApplicationStatus = "applied" | "not_applied" | "not_selected";

export interface ApplicationStatusEntry {
  jobId: string;
  title: string;
  company: string;
  status: ApplicationStatus;
  updatedAt: string;
}

export interface ApplicationStatusStore {
  updatedAt: string;
  entries: ApplicationStatusEntry[];
}

function emptyStore(): ApplicationStatusStore {
  return { updatedAt: new Date().toISOString(), entries: [] };
}

export function loadApplicationStatus(): ApplicationStatusStore {
  if (!fs.existsSync(APPLICATION_STATUS_PATH)) return emptyStore();
  try {
    return JSON.parse(fs.readFileSync(APPLICATION_STATUS_PATH, "utf-8")) as ApplicationStatusStore;
  } catch {
    return emptyStore();
  }
}

export function saveApplicationStatus(store: ApplicationStatusStore): void {
  const dir = path.dirname(APPLICATION_STATUS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = new Date().toISOString();
  fs.writeFileSync(APPLICATION_STATUS_PATH, JSON.stringify(store, null, 2), "utf-8");
}

export function getApplicationStatus(
  jobId: string,
  store = loadApplicationStatus()
): ApplicationStatus | null {
  return store.entries.find((e) => e.jobId === jobId)?.status ?? null;
}

export function setApplicationStatus(
  job: { id: string; title: string; company: string },
  status: ApplicationStatus | null
): ApplicationStatusStore {
  const store = loadApplicationStatus();
  store.entries = store.entries.filter((e) => e.jobId !== job.id);

  if (status) {
    store.entries.push({
      jobId: job.id,
      title: job.title,
      company: job.company,
      status,
      updatedAt: new Date().toISOString(),
    });
  }

  saveApplicationStatus(store);
  return store;
}
