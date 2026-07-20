/**
 * Parseo / elección de opciones numéricas en dropdowns Easy Apply
 * (años, escalas 1–10, "10+", rangos "8-9").
 */

export type YearsOption = {
  text: string;
  value: string | null;
  low: number;
  high: number;
  plus: boolean;
};

/** Extrae rango numérico de un label de option. null = no numérico. */
export function parseYearsOptionLabel(text: string): Omit<YearsOption, "text" | "value"> | null {
  const t = text.replace(/\s+/g, " ").trim();
  if (!t || t.length > 80) return null;
  if (/select an option|elige|seleccion|choose|seleccionar|select\.\.\.|—|–/i.test(t) && !/\d/.test(t)) {
    return null;
  }
  // Placeholder vacío
  if (/^Select|^Elige|^Seleccione/i.test(t) && !/\d/.test(t)) return null;

  // 10+, 10 +, Más de 10, More than 10, Over 10
  const plusM = /(?:más\s*de|more\s*than|over)\s*(\d+)|\b(\d+)\s*\+/i.exec(t);
  if (plusM) {
    const n = Number(plusM[1] || plusM[2]);
    if (Number.isFinite(n)) return { low: n, high: 99, plus: true };
  }

  // 8-9, 8 – 9, 8 a 9
  const dash = /(\d+)\s*[-–—]\s*(\d+)/.exec(t);
  if (dash) {
    const a = Number(dash[1]);
    const b = Number(dash[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { low: Math.min(a, b), high: Math.max(a, b), plus: false };
    }
  }
  const aRange = /(\d+)\s+a\s+(\d+)/i.exec(t);
  if (aRange) {
    const a = Number(aRange[1]);
    const b = Number(aRange[2]);
    if (Number.isFinite(a) && Number.isFinite(b)) {
      return { low: Math.min(a, b), high: Math.max(a, b), plus: false };
    }
  }

  // "9 years" / "9 años"
  const withUnit = /(\d+)\s*\+?\s*(years?|a[nñ]os?)\b/i.exec(t);
  if (withUnit) {
    const n = Number(withUnit[1]);
    const isPlus = /\+/.test(t);
    if (Number.isFinite(n)) return { low: n, high: isPlus ? 99 : n, plus: isPlus };
  }

  // Solo dígitos (o dígitos con poco texto: "Nivel 9")
  const plain = /^(\d+)\s*$/.exec(t);
  if (plain) {
    const n = Number(plain[1]);
    if (Number.isFinite(n)) return { low: n, high: n, plus: false };
  }
  // Texto corto con un solo número y sin CEFR/letras de nivel
  if (!/advanced|intermediate|beginner|native|fluent|basic|c1|c2|b1|b2|a1|a2|professional|proficient/i.test(t)) {
    const nums = [...t.matchAll(/\b(\d{1,2})\b/g)].map((m) => Number(m[1]));
    if (nums.length === 1 && Number.isFinite(nums[0]) && nums[0] <= 99) {
      return { low: nums[0], high: nums[0], plus: /\+/.test(t) };
    }
  }

  return null;
}

/**
 * Elige la option más adecuada para `targetYears`.
 * - Exacto / rango que contiene
 * - "N+" si target >= N
 * - Si target > todas → el máximo disponible (ej. 50 → 10+)
 */
export function pickBestYearsOption(
  options: { text: string; value: string | null }[],
  targetYears: number
): { text: string; value: string | null } | null {
  const parsed: YearsOption[] = [];
  for (const o of options) {
    const p = parseYearsOptionLabel(o.text);
    if (!p) continue;
    parsed.push({ text: o.text, value: o.value, ...p });
  }
  if (!parsed.length) return null;

  const exact = parsed.find((o) => !o.plus && o.low === targetYears && o.high === targetYears);
  if (exact) return { text: exact.text, value: exact.value };

  const inRange = parsed.filter((o) => targetYears >= o.low && targetYears <= o.high);
  if (inRange.length) {
    inRange.sort((a, b) => b.high - a.high || b.low - a.low);
    return { text: inRange[0].text, value: inRange[0].value };
  }

  const plusOk = parsed.filter((o) => o.plus && targetYears >= o.low);
  if (plusOk.length) {
    plusOk.sort((a, b) => b.low - a.low);
    return { text: plusOk[0].text, value: plusOk[0].value };
  }

  const maxHigh = Math.max(...parsed.map((o) => o.high));
  if (targetYears >= maxHigh) {
    const tops = parsed.filter((o) => o.high === maxHigh);
    tops.sort((a, b) => Number(b.plus) - Number(a.plus) || b.low - a.low);
    return { text: tops[0].text, value: tops[0].value };
  }

  // Más cercano por distancia al rango
  const dist = (o: YearsOption) => {
    if (targetYears < o.low) return o.low - targetYears;
    if (targetYears > o.high) return targetYears - o.high;
    return 0;
  };
  const sorted = [...parsed].sort((a, b) => dist(a) - dist(b) || b.high - a.high || b.low - a.low);
  return { text: sorted[0].text, value: sorted[0].value };
}

/** ¿La mayoría de options son numéricas? (escala años / 1–10). */
export function optionsLookNumeric(optionTexts: string[]): boolean {
  const meaningful = optionTexts
    .map((t) => t.replace(/\s+/g, " ").trim())
    .filter((t) => t && !/^Select|^Elige|^Seleccione|^—|^–/i.test(t));
  if (meaningful.length < 2) return false;
  const numeric = meaningful.filter((t) => parseYearsOptionLabel(t) != null);
  return numeric.length >= Math.ceil(meaningful.length * 0.6);
}
