/**
 * Rellena campos Easy Apply con respuestas del banco Config (#97 / #154).
 * Solo usa respuestas explícitas en output/config-questions.json (nunca inventa).
 */

import type { Locator, Page } from "playwright";
import { matchConfigAnswer } from "../config/questions-store.js";
import { hasPrefillValue } from "./fill-answers.js";

const EMPTY_SELECT_RE =
  /select an option|seleccion(a|á)|selecciona una opci|choose|eleg[ií]|elegir/i;

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function scopeRoot(page: Page): Locator {
  return page
    .locator(".jobs-easy-apply-modal")
    .or(page.locator(".jobs-easy-apply-content"))
    .or(page.locator("motion.div[class*='jobs-easy-apply']"))
    .or(page.locator("div[class*='jobs-easy-apply']"))
    .or(
      page.locator("[role='dialog']").filter({
        hasText:
          /Apply to|Postular|Contact info|Resume|Curr[ií]culum|Additional Questions|Preguntas|Review/i,
      })
    )
    .first();
}

async function fieldLabel(el: Locator): Promise<string> {
  const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
  if (aria) return aria;
  const id = (await el.getAttribute("id").catch(() => "")) ?? "";
  if (id) {
    const byFor = el.page().locator(`label[for="${id}"]`).first();
    const t = (await byFor.innerText().catch(() => "")).trim();
    if (t) return t.slice(0, 200);
  }
  const near = await el
    .evaluate((node) => {
      const wrap =
        node.closest(".fb-form-element, .jobs-easy-apply-form-element, fieldset, li, div") ??
        node.parentElement;
      const label = wrap?.querySelector("label, legend, span[class*='label']");
      return (label?.textContent ?? "").trim().slice(0, 200);
    })
    .catch(() => "");
  if (near) return near;
  return ((await el.getAttribute("placeholder")) ?? "").trim();
}

async function blobForControl(el: Locator): Promise<string> {
  const label = await fieldLabel(el);
  const aria = ((await el.getAttribute("aria-label")) ?? "").trim();
  const near = await el
    .evaluate((node) => {
      const wrap =
        node.closest(
          ".fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], fieldset, li, div"
        ) ?? node.parentElement;
      return (wrap?.textContent ?? "").trim().slice(0, 320);
    })
    .catch(() => "");
  return `${label} ${aria} ${near}`.replace(/\s+/g, " ").trim();
}

function normalizeOptionText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function pickOptionByAnswer(
  options: { text: string; value: string | null }[],
  answer: string
): { text: string; value: string | null } | null {
  const want = normalizeOptionText(answer);
  if (!want) return null;

  for (const opt of options) {
    const t = normalizeOptionText(opt.text);
    if (!t || EMPTY_SELECT_RE.test(opt.text)) continue;
    if (t === want) return opt;
  }
  for (const opt of options) {
    const t = normalizeOptionText(opt.text);
    if (!t || EMPTY_SELECT_RE.test(opt.text)) continue;
    if (t.includes(want) || want.includes(t)) return opt;
  }
  return null;
}

async function readSelectOptions(sel: Locator): Promise<{ text: string; value: string | null }[]> {
  const optionEls = sel.locator("option");
  const oc = await optionEls.count().catch(() => 0);
  const opts: { text: string; value: string | null }[] = [];
  for (let o = 0; o < oc; o++) {
    const opt = optionEls.nth(o);
    const text = ((await opt.innerText().catch(() => "")) ?? "").trim();
    const value = await opt.getAttribute("value");
    opts.push({ text, value });
  }
  return opts;
}

async function fillSelectWithAnswer(
  sel: Locator,
  answer: string,
  logLabel: string
): Promise<boolean> {
  const cur = ((await sel.inputValue().catch(() => "")) ?? "").trim();
  const curText = (
    (await sel.locator("option:checked").innerText().catch(() => "")) || cur
  ).trim();
  if (hasPrefillValue(curText) && !EMPTY_SELECT_RE.test(curText)) {
    const want = normalizeOptionText(answer);
    const have = normalizeOptionText(curText);
    if (have === want || have.includes(want) || want.includes(have)) {
      console.log(`   ↳ Config [${logLabel}]: dejo prefill ("${curText.slice(0, 40)}")`);
      return true;
    }
  }

  const opts = await readSelectOptions(sel);
  const yesNoOnly =
    opts.filter((o) => o.text && !EMPTY_SELECT_RE.test(o.text)).length <= 3 &&
    opts.some((o) => /^(Yes|Sí|Si|No)$/i.test(o.text.trim()));

  if (yesNoOnly) {
    const wantYes = /^(yes|sí|si)$/i.test(answer.trim());
    const wantNo = /^no$/i.test(answer.trim());
    if (wantYes || wantNo) {
      for (const opt of opts) {
        const lab = opt.text.trim();
        if (!lab || EMPTY_SELECT_RE.test(lab)) continue;
        const isYes = /^(Yes|Sí|Si)$/i.test(lab);
        const isNo = /^No$/i.test(lab);
        if (wantYes ? isYes : wantNo ? isNo : false) {
          if (opt.value != null && opt.value !== "") await sel.selectOption(opt.value);
          else await sel.selectOption({ label: lab }).catch(() => {});
          console.log(`   ↳ Config [${logLabel}]: ${lab} (Sí/No)`);
          await sleep(250);
          return true;
        }
      }
    }
  }

  const picked = pickOptionByAnswer(opts, answer);
  if (!picked) {
    console.log(`   ↳ Config [${logLabel}]: sin opción para "${answer.slice(0, 40)}"`);
    return false;
  }
  if (picked.value != null && picked.value !== "") await sel.selectOption(picked.value);
  else await sel.selectOption({ label: picked.text }).catch(() => {});
  console.log(`   ↳ Config [${logLabel}]: ${picked.text.slice(0, 60)}`);
  await sleep(250);
  return true;
}

async function fillTextWithAnswer(el: Locator, answer: string, logLabel: string): Promise<boolean> {
  const current = ((await el.inputValue().catch(() => "")) ?? "").trim();
  if (hasPrefillValue(current)) {
    console.log(`   ↳ Config [${logLabel}]: dejo prefill texto`);
    return true;
  }
  await el.click({ timeout: 2000 }).catch(() => {});
  await el.fill("");
  await el.fill(answer);
  console.log(`   ↳ Config [${logLabel}]: ${answer.slice(0, 60)}`);
  await sleep(200);
  return true;
}

async function fillRadioWithAnswer(block: Locator, answer: string, logLabel: string): Promise<boolean> {
  const want = answer.trim();
  const radio = block.getByRole("radio", { name: new RegExp(`^${want.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i") }).first();
  if (await radio.isVisible({ timeout: 400 }).catch(() => false)) {
    await radio.click({ force: true }).catch(() => {});
    console.log(`   ↳ Config [${logLabel}]: radio ${want}`);
    return true;
  }
  const yes = /^(yes|sí|si)$/i.test(want);
  const no = /^no$/i.test(want);
  if (yes || no) {
    const target = block
      .getByRole("radio", { name: yes ? /^(Yes|Sí|Si)$/i : /^No$/i })
      .first();
    if (await target.isVisible({ timeout: 400 }).catch(() => false)) {
      await target.click({ force: true }).catch(() => {});
      console.log(`   ↳ Config [${logLabel}]: radio ${yes ? "Sí" : "No"}`);
      return true;
    }
  }
  return false;
}

/**
 * Aplica respuestas answered del banco Config en el paso actual del modal EA.
 */
export async function fillConfigBankAnswers(page: Page): Promise<number> {
  const root = scopeRoot(page);
  if (!(await root.isVisible({ timeout: 800 }).catch(() => false))) return 0;

  let filled = 0;
  const handled = new Set<string>();

  const selects = root.locator("select");
  const sn = await selects.count().catch(() => 0);
  for (let i = 0; i < sn; i++) {
    const el = selects.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const blob = await blobForControl(el);
    const hit = matchConfigAnswer(blob);
    if (!hit) continue;
    const key = hit.label.toLowerCase();
    if (handled.has(key)) continue;
    if (await fillSelectWithAnswer(el, hit.answer, hit.label.slice(0, 48))) {
      handled.add(key);
      filled++;
    }
  }

  const controls = root.locator(
    "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
  );
  const n = await controls.count();
  for (let i = 0; i < n; i++) {
    const el = controls.nth(i);
    if (!(await el.isVisible().catch(() => false))) continue;
    const blob = await blobForControl(el);
    const hit = matchConfigAnswer(blob);
    if (!hit) continue;
    const key = hit.label.toLowerCase();
    if (handled.has(key)) continue;
    if (await fillTextWithAnswer(el, hit.answer, hit.label.slice(0, 48))) {
      handled.add(key);
      filled++;
    }
  }

  const blocks = root.locator(
    "fieldset, .fb-form-element, .jobs-easy-apply-form-element, [data-test-form-element], li.jobs-easy-apply-form-section__grouping"
  );
  const bn = await blocks.count().catch(() => 0);
  for (let i = 0; i < Math.min(bn, 40); i++) {
    const block = blocks.nth(i);
    if (!(await block.isVisible().catch(() => false))) continue;
    const blob = ((await block.innerText().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
    const hit = matchConfigAnswer(blob);
    if (!hit) continue;
    const key = hit.label.toLowerCase();
    if (handled.has(key)) continue;
    const radios = block.locator("input[type='radio']");
    if ((await radios.count().catch(() => 0)) === 0) continue;
    if (await fillRadioWithAnswer(block, hit.answer, hit.label.slice(0, 48))) {
      handled.add(key);
      filled++;
    }
  }

  return filled;
}
