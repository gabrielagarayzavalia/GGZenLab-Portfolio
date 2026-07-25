/**
 * Captura de opciones para banco Config.
 *   npm run test:field-options
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  cleanCapturedOptions,
  extractOptionsFromLabelBlob,
} from "../../src/apply/field-options.js";

test("extractOptionsFromLabelBlob: tras Select an option", () => {
  const opts = extractOptionsFromLabelBlob(
    "What is your level of proficiency in English? Select an option Professional Conversational"
  );
  assert.ok(opts.some((o) => /professional/i.test(o)));
});

test("extractOptionsFromLabelBlob: líneas Yes/No", () => {
  const opts = extractOptionsFromLabelBlob("Yes\nNo");
  assert.deepEqual(opts, ["Yes", "No"]);
});

test("cleanCapturedOptions: filtra placeholder", () => {
  const opts = cleanCapturedOptions(["Select an option", "Professional", ""]);
  assert.deepEqual(opts, ["Professional"]);
});
