import path from "path";

/** file:// URL estable para fixtures locales (Windows incluido). */
export function fixtureFileUrl(relativePathFromProjectRoot: string): string {
  const absolute = path.resolve(__dirname, "..", relativePathFromProjectRoot);
  return `file:///${absolute.replace(/\\/g, "/")}`;
}

export const INTERVIEW_UI_LAB_URL = fixtureFileUrl("fixtures/interview-ui-lab.html");
