/**
 * Smoke unitario store Fuentes/Sitios (B18-05/07).
 *   npx tsx --test tests/config/sources-store.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";

test("builtins include linkedin+indeed and isSourceEnabled respects toggle", async () => {
  const mod = await import("../../src/config/sources-store.js");
  const store = mod.loadSourcesConfig();
  assert.ok(store.sources.some((s) => s.adapterId === "indeed"));
  assert.ok(store.sources.some((s) => s.adapterId === "linkedin"));
  const indeed = store.sources.find((s) => s.adapterId === "indeed");
  assert.ok(indeed);
  mod.patchSource(indeed!.id, { enabled: false });
  assert.equal(mod.isSourceEnabled("indeed"), false);
  mod.patchSource(indeed!.id, { enabled: true });
  assert.equal(mod.isSourceEnabled("indeed"), true);
});

test("alta sitio + archivar", async () => {
  const mod = await import("../../src/config/sources-store.js");
  const before = mod.listSources({ kind: "site" }).length;
  const store = mod.upsertSource({
    kind: "site",
    name: "Bumeran Test",
    url: "https://www.bumeran.com.ar/",
  });
  const site = store.sources.find((s) => s.name === "Bumeran Test");
  assert.ok(site);
  assert.equal(site!.kind, "site");
  mod.patchSource(site!.id, { archived: true, enabled: false });
  assert.equal(mod.listSources({ kind: "site" }).some((s) => s.id === site!.id), false);
  assert.equal(
    mod.listSources({ kind: "site", includeArchived: true }).some((s) => s.id === site!.id),
    true
  );
  assert.ok(mod.listSources({ kind: "site" }).length >= before);
});
