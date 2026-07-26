import test from "node:test";
import assert from "node:assert/strict";
import {
  isDesktopExcelEnabled,
  isExcelOpenAtEndEnabled,
} from "../../src/tracker/excel-legacy.js";

test("isDesktopExcelEnabled default off", () => {
  const prev = process.env.OPEN_DESKTOP_EXCEL;
  delete process.env.OPEN_DESKTOP_EXCEL;
  assert.equal(isDesktopExcelEnabled(), false);
  process.env.OPEN_DESKTOP_EXCEL = "1";
  assert.equal(isDesktopExcelEnabled(), true);
  if (prev === undefined) delete process.env.OPEN_DESKTOP_EXCEL;
  else process.env.OPEN_DESKTOP_EXCEL = prev;
});

test("isExcelOpenAtEndEnabled respeta OPEN_EXCEL", () => {
  const prev = process.env.OPEN_EXCEL;
  delete process.env.OPEN_EXCEL;
  assert.equal(isExcelOpenAtEndEnabled(), false);
  process.env.OPEN_EXCEL = "true";
  assert.equal(isExcelOpenAtEndEnabled(), true);
  if (prev === undefined) delete process.env.OPEN_EXCEL;
  else process.env.OPEN_EXCEL = prev;
});
