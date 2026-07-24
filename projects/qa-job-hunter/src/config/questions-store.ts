/**
 * Banco Config de preguntas Easy Apply (B18-02 / #97 + política #154).
 * Alta automática sin respuesta; completar después en Config.
 * Persistencia MVP: output/config-questions.json (#101 → Mongo).
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import type { UnknownQuestionHit } from "../apply/unknown-questions.js";
import { cleanFieldLabel } from "../apply/unknown-questions.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
export const CONFIG_QUESTIONS_PATH = path.join(ROOT, "output", "config-questions.json");

export type ConfigQuestionOrigin = "auto_apply" | "manual";
export type ConfigQuestionStatus = "unanswered" | "answered" | "archived";

export interface ConfigQuestion {
  id: string;
  label: string;
  kind: string;
  required: boolean;
  /** Respuesta (vacía hasta completar en Config). */
  answer: string;
  options: string[];
  origin: ConfigQuestionOrigin;
  status: ConfigQuestionStatus;
  /** Último jobId que disparó el alta/auto. */
  lastJobId?: string;
  lastCompany?: string;
  lastTitle?: string;
  seenCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConfigQuestionsStore {
  updatedAt: string;
  questions: ConfigQuestion[];
}

function nowIso(): string {
  return new Date().toISOString();
}

function emptyStore(): ConfigQuestionsStore {
  return { updatedAt: nowIso(), questions: [] };
}

export function normalizeQuestionKey(label: string): string {
  return cleanFieldLabel(label).toLowerCase().replace(/\s+/g, " ").trim().slice(0, 160);
}

function normalizeKey(label: string): string {
  return normalizeQuestionKey(label);
}

export type ConfigAnswerMatch = {
  label: string;
  answer: string;
  kind: string;
};

let answeredCache: Map<string, ConfigAnswerMatch> | null = null;

/** Invalida cache tras patch/save (apply lee respuestas frescas). */
export function resetAnsweredQuestionsCache(): void {
  answeredCache = null;
}

function loadAnsweredCache(): Map<string, ConfigAnswerMatch> {
  if (!answeredCache) {
    answeredCache = new Map();
    for (const q of loadQuestionsConfig().questions) {
      if (q.status !== "answered") continue;
      const answer = q.answer.trim();
      if (!answer) continue;
      answeredCache.set(normalizeKey(q.label), {
        label: q.label,
        answer,
        kind: q.kind,
      });
    }
  }
  return answeredCache;
}

/**
 * Busca respuesta del banco Config para un label/blob de campo EA.
 * Match por clave normalizada (exacta o substring).
 */
export function matchConfigAnswer(blob: string): ConfigAnswerMatch | null {
  const b = normalizeKey(blob);
  if (!b || b.length < 4) return null;
  const cache = loadAnsweredCache();
  for (const [key, entry] of cache) {
    if (key.length < 4) continue;
    if (b === key || b.includes(key) || key.includes(b)) return entry;
  }
  return null;
}

function slugId(label: string): string {
  const base = normalizeKey(label)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `q-${base || "item"}-${Date.now().toString(36)}`;
}

export function loadQuestionsConfig(): ConfigQuestionsStore {
  if (!fs.existsSync(CONFIG_QUESTIONS_PATH)) return emptyStore();
  try {
    const raw = JSON.parse(fs.readFileSync(CONFIG_QUESTIONS_PATH, "utf-8")) as ConfigQuestionsStore;
    if (!raw || !Array.isArray(raw.questions)) return emptyStore();
    return raw;
  } catch {
    return emptyStore();
  }
}

export function saveQuestionsConfig(store: ConfigQuestionsStore): void {
  const dir = path.dirname(CONFIG_QUESTIONS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  store.updatedAt = nowIso();
  fs.writeFileSync(CONFIG_QUESTIONS_PATH, JSON.stringify(store, null, 2), "utf-8");
  resetAnsweredQuestionsCache();
}

export function listQuestions(opts?: {
  status?: ConfigQuestionStatus;
  includeArchived?: boolean;
}): ConfigQuestion[] {
  const store = loadQuestionsConfig();
  return store.questions.filter((q) => {
    if (opts?.status) return q.status === opts.status;
    if (!opts?.includeArchived && q.status === "archived") return false;
    return true;
  });
}

export type UpsertUnknownMeta = {
  jobId?: string;
  company?: string;
  title?: string;
};

/**
 * Alta / bump de preguntas sin respuesta (política #154).
 * No inventa `answer`. Si ya existe y está answered, no la pisa.
 */
export function upsertUnansweredFromHits(
  hits: UnknownQuestionHit[],
  meta: UpsertUnknownMeta = {}
): ConfigQuestion[] {
  if (hits.length === 0) return [];
  const store = loadQuestionsConfig();
  const t = nowIso();
  const touched: ConfigQuestion[] = [];

  for (const hit of hits) {
    const label = cleanFieldLabel(hit.label) || hit.label.trim();
    if (label.length < 3) continue;
    const key = normalizeKey(label);
    let existing = store.questions.find((q) => normalizeKey(q.label) === key);

    if (existing) {
      if (existing.status === "answered") {
        // Ya tiene respuesta en banco — no degradar; solo bump seen
        existing.seenCount += 1;
        existing.updatedAt = t;
        if (meta.jobId) existing.lastJobId = meta.jobId;
        if (meta.company) existing.lastCompany = meta.company;
        if (meta.title) existing.lastTitle = meta.title;
        touched.push(existing);
        continue;
      }
      existing.kind = hit.kind || existing.kind;
      existing.required = existing.required || !!hit.required;
      existing.seenCount += 1;
      existing.status = "unanswered";
      existing.updatedAt = t;
      if (meta.jobId) existing.lastJobId = meta.jobId;
      if (meta.company) existing.lastCompany = meta.company;
      if (meta.title) existing.lastTitle = meta.title;
      if (hit.options?.length) {
        const set = new Set([...(existing.options || []), ...hit.options]);
        existing.options = [...set].slice(0, 40);
      }
      touched.push(existing);
      continue;
    }

    const created: ConfigQuestion = {
      id: slugId(label),
      label,
      kind: hit.kind || "unknown",
      required: !!hit.required,
      answer: "",
      options: hit.options?.slice(0, 40) ?? [],
      origin: "auto_apply",
      status: "unanswered",
      lastJobId: meta.jobId,
      lastCompany: meta.company,
      lastTitle: meta.title,
      seenCount: 1,
      createdAt: t,
      updatedAt: t,
    };
    store.questions.push(created);
    touched.push(created);
  }

  saveQuestionsConfig(store);
  return touched;
}

export function patchQuestion(
  id: string,
  patch: Partial<Pick<ConfigQuestion, "answer" | "status" | "label" | "kind">>
): ConfigQuestionsStore {
  const store = loadQuestionsConfig();
  const idx = store.questions.findIndex((q) => q.id === id);
  if (idx < 0) throw new Error(`Pregunta no encontrada: ${id}`);
  const prev = store.questions[idx];
  const answer =
    patch.answer !== undefined ? String(patch.answer).trim() : prev.answer;
  let status = patch.status ?? prev.status;
  if (patch.answer !== undefined && answer && status === "unanswered") {
    status = "answered";
  }
  if (patch.answer !== undefined && !answer && status === "answered") {
    status = "unanswered";
  }
  store.questions[idx] = {
    ...prev,
    label: patch.label?.trim() || prev.label,
    kind: patch.kind?.trim() || prev.kind,
    answer,
    status,
    updatedAt: nowIso(),
  };
  saveQuestionsConfig(store);
  return store;
}

export function addManualQuestion(input: {
  label: string;
  kind?: string;
  required?: boolean;
  answer?: string;
}): ConfigQuestion {
  const label = cleanFieldLabel(input.label) || input.label.trim();
  if (label.length < 3) throw new Error("label demasiado corto");
  const answer = (input.answer || "").trim();
  const store = loadQuestionsConfig();
  const t = nowIso();
  const q: ConfigQuestion = {
    id: slugId(label),
    label,
    kind: input.kind || "text",
    required: !!input.required,
    answer,
    options: [],
    origin: "manual",
    status: answer ? "answered" : "unanswered",
    seenCount: 1,
    createdAt: t,
    updatedAt: t,
  };
  store.questions.push(q);
  saveQuestionsConfig(store);
  return q;
}
