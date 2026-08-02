import test from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const DASHBOARD_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../dashboard"
);

function readHtml(name: string): string {
  return fs.readFileSync(path.join(DASHBOARD_DIR, name), "utf-8");
}

function assertNavLink(html: string, testid: string, href: string): void {
  const re = new RegExp(
    `data-testid="${testid}"[^>]*href="${href.replace(/\//g, "\\/")}"|href="${href.replace(/\//g, "\\/")}"[^>]*data-testid="${testid}"`
  );
  assert.match(html, re, `expected nav link ${testid} → ${href}`);
}

const NAV_PAGES: Array<{ file: string; links: Array<[string, string]> }> = [
  {
    file: "index.html",
    links: [
      ["nav-link-dashboard", "/"],
      ["nav-link-tracker", "/tracker"],
      ["nav-link-run", "/run"],
      ["nav-link-config", "/config"],
    ],
  },
  {
    file: "config.html",
    links: [
      ["nav-link-dashboard", "/"],
      ["nav-link-config", "/config"],
    ],
  },
  {
    file: "run.html",
    links: [
      ["nav-link-dashboard", "/"],
      ["nav-link-run", "/run"],
      ["nav-link-config", "/config"],
    ],
  },
  {
    file: "tracker.html",
    links: [
      ["nav-link-dashboard", "/"],
      ["nav-link-tracker", "/tracker"],
      ["nav-link-mlite", "/m-lite.html"],
      ["nav-link-run", "/run"],
      ["nav-link-config", "/config"],
    ],
  },
];

for (const { file, links } of NAV_PAGES) {
  test(`${file} expone data-testid en nav`, () => {
    const html = readHtml(file);
    for (const [testid, href] of links) {
      assertNavLink(html, testid, href);
    }
  });
}

<<<<<<< HEAD
test("index.html expone data-testid de filtros empresa y puesto", () => {
  const html = readHtml("index.html");
  for (const testid of ["dash-filter-company", "dash-filter-title"]) {
    assert.match(html, new RegExp(`data-testid="${testid}"`), `missing ${testid}`);
  }
});

test("index.html expone sidebar de filtros estado con data-testid", () => {
  const html = readHtml("index.html");
  assert.match(html, /data-testid="dash-sidebar-filters"/);
  const bucketTestids = [
    "dash-filter-unmarked",
    "dash-filter-applied",
    "dash-filter-not-applied",
    "dash-filter-not-selected",
    "dash-filter-assessment",
    "dash-filter-assessment-done",
    "dash-filter-rejected",
    "dash-filter-closed",
    "dash-filter-duplicated",
  ];
  for (const testid of bucketTestids) {
    assert.match(html, new RegExp(`data-testid="${testid}"`), `missing ${testid}`);
  }
  assert.doesNotMatch(html, /class="list-filters"/, "state filters should not stay in list-header");
});

test("app.js expone empty state filtrado por dropdown", () => {
  const appJs = fs.readFileSync(path.join(DASHBOARD_DIR, "app.js"), "utf-8");
  assert.match(appJs, /data-testid", "list-empty-filtered"/);
  assert.match(
    appJs,
    /No se encontraron empleos para el criterio seleccionado/
  );
  assert.match(appJs, /buildFilterSelectOptions/);
  assert.match(appJs, /data-testid="dash-detail-write-hint"/);
});

=======
>>>>>>> origin/main
test("run.html expone data-testid de controles Easy Apply", () => {
  const html = readHtml("run.html");
  const runTestids = [
    "run-mode-dry",
    "run-mode-productive",
    "run-apply-max",
    "run-job-id",
    "run-apply-btn",
    "run-cancel-btn",
    "run-status",
    "run-state-text",
    "run-log",
<<<<<<< HEAD
    "run-confirm-dialog",
    "run-confirm-dismiss",
    "run-confirm-accept",
=======
>>>>>>> origin/main
  ];
  for (const testid of runTestids) {
    assert.match(html, new RegExp(`data-testid="${testid}"`), `missing ${testid}`);
  }
  assert.match(html, /id="run-apply-max"[^>]*data-testid="run-apply-max"|data-testid="run-apply-max"[^>]*id="run-apply-max"/);
  assert.match(html, /value="dry_run"[^>]*data-testid="run-mode-dry"|data-testid="run-mode-dry"[^>]*value="dry_run"/);
  assert.match(html, /value="productive"[^>]*data-testid="run-mode-productive"|data-testid="run-mode-productive"[^>]*value="productive"/);
});
