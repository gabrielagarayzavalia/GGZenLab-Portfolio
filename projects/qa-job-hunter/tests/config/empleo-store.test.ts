/**
 * Empleo buscado B18-04 / #99.
 *   npx tsx --test tests/config/empleo-store.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  listActiveEmpleoProfiles,
  listEmpleoProfiles,
  loadEmpleoConfig,
  patchEmpleoProfile,
  upsertEmpleoProfile,
} from "../../src/config/empleo-store.js";

test("seed default + activos", () => {
  const store = loadEmpleoConfig();
  assert.ok(store.profiles.length >= 1);
  assert.ok(listActiveEmpleoProfiles().length >= 1);
});

test("alta + archivar", () => {
  const store = upsertEmpleoProfile({
    title: "SDET remote only",
    keywords: "playwright",
    seniority: "senior",
    remote: "remote",
    location: "LATAM",
    notes: "test",
  });
  const p = store.profiles.find((x) => x.title === "SDET remote only");
  assert.ok(p);
  assert.equal(p!.seniority, "senior");
  patchEmpleoProfile(p!.id, { archived: true, enabled: false });
  assert.equal(listEmpleoProfiles().some((x) => x.id === p!.id), false);
  assert.equal(
    listEmpleoProfiles({ includeArchived: true }).some((x) => x.id === p!.id),
    true
  );
});
