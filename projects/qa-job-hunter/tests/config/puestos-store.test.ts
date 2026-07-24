/**
 * Puestos Config B18-08 / #197.
 *   npx tsx --test tests/config/puestos-store.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  listActivePuestoTitles,
  listPuestos,
  loadPuestosConfig,
  patchPuesto,
  upsertPuesto,
} from "../../src/config/puestos-store.js";

test("seed builtins + listActivePuestoTitles", () => {
  const store = loadPuestosConfig();
  assert.ok(store.puestos.length >= 3);
  const titles = listActivePuestoTitles();
  assert.ok(titles.some((t) => /QA/i.test(t)));
});

test("alta + archivar + toggle", () => {
  const store = upsertPuesto({
    title: "SDET Playwright",
    keywords: "playwright, typescript",
  });
  const p = store.puestos.find((x) => x.title === "SDET Playwright");
  assert.ok(p);
  patchPuesto(p!.id, { enabled: false });
  assert.equal(listActivePuestoTitles().includes("SDET Playwright"), false);
  patchPuesto(p!.id, { archived: true, enabled: false });
  assert.equal(listPuestos().some((x) => x.id === p!.id), false);
  assert.equal(listPuestos({ includeArchived: true }).some((x) => x.id === p!.id), true);
});
