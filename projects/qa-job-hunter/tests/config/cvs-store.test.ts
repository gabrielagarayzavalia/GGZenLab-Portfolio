/**
 * CVs Config B18-03 / #98.
 *   npx tsx --test tests/config/cvs-store.test.ts
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  addCvFromBuffer,
  deleteCv,
  listCvs,
  loadCvsConfig,
  patchCv,
  validateCvUpload,
} from "../../src/config/cvs-store.js";

const MIN_PDF = Buffer.from("%PDF-1.4 test\n", "utf-8");

test("validateCvUpload rechaza no-pdf", () => {
  assert.throws(() => validateCvUpload("x.txt", "text/plain", Buffer.from("hi")), /pdf/i);
  assert.throws(() => validateCvUpload("x.pdf", "application/pdf", Buffer.from("notpdf")), /PDF válido/);
});

test("add default + patch + delete", () => {
  const cv = addCvFromBuffer({
    originalName: "QA_Automation.pdf",
    buffer: MIN_PDF,
    label: "QA Automation CV",
  });
  assert.ok(cv.isDefault);
  assert.equal(listCvs().length, 1);

  const cv2 = addCvFromBuffer({
    originalName: "QA_Analyst.pdf",
    buffer: MIN_PDF,
    setDefault: true,
  });
  const store = loadCvsConfig();
  const first = store.cvs.find((c) => c.id === cv.id);
  const second = store.cvs.find((c) => c.id === cv2.id);
  assert.equal(first?.isDefault, false);
  assert.equal(second?.isDefault, true);

  patchCv(cv2.id, { empleoProfileId: "empleo-test", archived: true });
  assert.equal(listCvs().some((c) => c.id === cv2.id), false);

  deleteCv(cv.id);
  deleteCv(cv2.id);
  assert.equal(listCvs().length, 0);
});
