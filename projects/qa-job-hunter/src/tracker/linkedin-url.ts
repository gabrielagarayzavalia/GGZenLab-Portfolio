/** Normaliza URL LinkedIn jobs para dedupe / índice único. */

const JOB_ID_RE = /(?:currentJobId=|\/jobs\/view\/)(\d+)/;

export function extractJobId(url: string): string | undefined {
  const m = (url ?? "").match(JOB_ID_RE);
  return m?.[1];
}

export function normalizeLinkedInUrl(url: string): string {
  const raw = (url ?? "").trim();
  if (!raw || raw === "—") return "";
  const jobId = extractJobId(raw);
  if (jobId) return `https://www.linkedin.com/jobs/view/${jobId}/`;
  return raw.replace(/\?.*$/, "").replace(/\/$/, "");
}
