import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DASHBOARD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dashboard"
);

test("m-lite.js wired a tracker API (no sample-data)", () => {
  const src = fs.readFileSync(path.join(DASHBOARD_DIR, "m-lite.js"), "utf-8");
  assert.doesNotMatch(src, /sample-data/);
  assert.match(src, /\/api\/tracker\/applications/);
  assert.match(src, /apiFetch/);
});

test("tracker.html expone botón export xlsx", () => {
  const html = fs.readFileSync(path.join(DASHBOARD_DIR, "tracker.html"), "utf-8");
  assert.match(html, /id="btn-export"/);
  assert.match(html, /Exportar \.xlsx/);
});

test("tracker.js llama export API", () => {
  const src = fs.readFileSync(path.join(DASHBOARD_DIR, "tracker.js"), "utf-8");
  assert.match(src, /\/api\/tracker\/export\/xlsx/);
});
