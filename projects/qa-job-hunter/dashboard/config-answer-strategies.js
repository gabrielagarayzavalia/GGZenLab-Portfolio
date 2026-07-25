/**
 * Strategy pattern — widget de respuesta en Config Preguntas (#97 / #241).
 * Dropdown solo para opciones reales (Sí/No, idioma). Resto → texto/número;
 * opciones capturadas en apply van como hint debajo del campo Respuesta.
 */

const EMPTY_OPTION_RE =
  /^(select an option|seleccion(a|á)|choose|eleg[ií]|pick\b|selecciona una opci)/i;
const NOISE_OPTION_RE = /^(required|yes no)$/i;

/** Sugerencias LinkedIn idiomas (cuando kind=select y options vacío). */
export const LANGUAGE_PROFICIENCY_OPTIONS = [
  "Ninguno",
  "Básico / A2",
  "Intermedio / B1",
  "Intermedio alto / B2",
  "Avanzado / C1",
  "Nativo / C2",
  "Conversational",
  "Professional",
  "Native or bilingual",
];

const YES_NO_OPTIONS = ["Sí", "No", "Yes"];
const YEARS_QUICK_OPTIONS = ["-", "0"];

/** Evita que `0` se pierda con `|| ""`. */
export function normalizeConfigAnswerValue(value) {
  if (value === undefined || value === null) return "";
  if (value === 0) return "0";
  return String(value).trim();
}

function displayAnswerValue(value) {
  return normalizeConfigAnswerValue(value);
}

function buildYearsSelectOptions(label, rawOptions) {
  const captured = actionableOptions(label, rawOptions).filter(
    (o) => o === "-" || o === "0" || /^\d{1,2}$/.test(o) || /^\d+\s*\+$/.test(o)
  );
  const nums = [];
  for (let i = 1; i <= 25; i++) nums.push(String(i));
  return [...new Set([...YEARS_QUICK_OPTIONS, ...captured, ...nums])].slice(0, 40);
}

function normalizeCompare(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanOptions(raw) {
  return [...new Set((raw || []).map((o) => String(o).trim()).filter(Boolean))]
    .filter((o) => !EMPTY_OPTION_RE.test(o))
    .slice(0, 40);
}

/** Quita eco del label, "Required", blobs concatenados, etc. */
export function actionableOptions(label, raw) {
  const l = normalizeCompare(label);
  return cleanOptions(raw).filter((o) => {
    const n = normalizeCompare(o);
    if (!n || NOISE_OPTION_RE.test(n)) return false;
    if (n === l) return false;
    if (l && n.length > 80) return false;
    if (l && l.includes(n) && n.length >= Math.min(24, l.length * 0.55)) return false;
    if (l && n.includes(l) && l.length >= Math.min(24, n.length * 0.55)) return false;
    return true;
  });
}

export function formatCapturedOptionsHint(label, options) {
  const opts = actionableOptions(label, options);
  if (opts.length === 0) return "";
  const quoted = opts.map((o) => `«${o}»`).join(", ");
  return `Opciones vistas en apply (elegí o escribí el texto exacto): ${quoted}`;
}

function isYesNoOptions(options) {
  const norm = options.map((o) => normalizeCompare(o));
  return norm.includes("sí") || norm.includes("si") || norm.includes("yes");
}

function isLanguageLabel(label) {
  return /portugu|ingl[eé]s|idioma|language|proficiency|nivel|franc[eé]s|alem[aá]n|italiano/i.test(
    label || ""
  );
}

function isYearsExperienceLabel(label) {
  return /how many years|years?\s+of\s+work\s+experience|a[nñ]os?\s+de\s+experiencia/i.test(
    label || ""
  );
}

function shouldUseDropdown(question, options) {
  const label = question.label || "";
  const kind = String(question.kind || "text").toLowerCase();
  const opts = actionableOptions(label, options);

  if (isYearsExperienceLabel(label)) return false;
  if (kind === "text" || kind === "number" || kind === "textarea" || kind === "tel") {
    return false;
  }

  if (opts.length >= 2 && opts.length <= 4 && isYesNoOptions(opts)) return true;

  if ((kind === "select" || kind === "listbox") && isLanguageLabel(label) && opts.length === 0) {
    return true;
  }

  if (opts.length >= 2 && opts.length <= 12 && opts.every((o) => o.length <= 60)) {
    return true;
  }

  if (kind === "radio" && opts.length === 0) return true;

  return false;
}

function selectStrategy(options, hint) {
  const opts = cleanOptions(options);
  return {
    id: "select",
    hint: hint || "Elegí la opción exacta del dropdown de LinkedIn.",
    capturedOptionsHint: "",
    mount(container, { currentAnswer }) {
      container.innerHTML = "";
      const label = document.createElement("label");
      label.className = "config-field";
      const span = document.createElement("span");
      span.textContent = "Respuesta";
      const sel = document.createElement("select");
      sel.name = "answer";
      sel.required = true;
      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "— Elegir —";
      sel.appendChild(blank);
      for (const o of opts) {
        const opt = document.createElement("option");
        opt.value = o;
        opt.textContent = o;
        if (displayAnswerValue(currentAnswer) === o) opt.selected = true;
        sel.appendChild(opt);
      }
      label.append(span, sel);
      container.appendChild(label);
    },
    readValue(container) {
      const sel = container.querySelector("select[name=answer]");
      const raw = sel?.value;
      return raw === undefined || raw === null ? "" : String(raw).trim();
    },
  };
}

function textStrategy(hint) {
  return {
    id: "text",
    hint: hint || "Texto libre (debe coincidir con lo que acepta el formulario).",
    capturedOptionsHint: "",
    mount(container, { currentAnswer }) {
      container.innerHTML = "";
      const label = document.createElement("label");
      label.className = "config-field";
      const span = document.createElement("span");
      span.textContent = "Respuesta";
      const input = document.createElement("input");
      input.type = "text";
      input.name = "answer";
      input.maxLength = 400;
      input.placeholder = "Escribí la respuesta…";
      input.value = displayAnswerValue(currentAnswer);
      input.autocomplete = "off";
      label.append(span, input);
      container.appendChild(label);
    },
    readValue(container) {
      const input = container.querySelector("input[name=answer]");
      const raw = input?.value;
      return raw === undefined || raw === null ? "" : String(raw).trim();
    },
  };
}

function yearsExperienceStrategy(label, rawOptions) {
  const opts = buildYearsSelectOptions(label, rawOptions);
  const base = selectStrategy(
    opts,
    "Años de experiencia. «-» = ninguno / cero años (equivale a 0 en el wizard)."
  );
  return {
    ...base,
    id: "years-select",
    capturedOptionsHint: formatCapturedOptionsHint(label, rawOptions),
  };
}

function numberStrategy(hint) {
  return {
    id: "number",
    hint: hint || "Número (años, cantidad, etc.).",
    capturedOptionsHint: "",
    mount(container, { currentAnswer }) {
      container.innerHTML = "";
      const label = document.createElement("label");
      label.className = "config-field";
      const span = document.createElement("span");
      span.textContent = "Respuesta";
      const input = document.createElement("input");
      input.type = "number";
      input.name = "answer";
      input.min = "0";
      input.max = "99";
      input.step = "1";
      input.value = displayAnswerValue(currentAnswer);
      input.autocomplete = "off";
      label.append(span, input);
      container.appendChild(label);
    },
    readValue(container) {
      const input = container.querySelector("input[name=answer]");
      const raw = input?.value;
      return raw === undefined || raw === null ? "" : String(raw).trim();
    },
  };
}

function withCapturedHint(strategy, label, rawOptions) {
  const captured = formatCapturedOptionsHint(label, rawOptions);
  return { ...strategy, capturedOptionsHint: captured };
}

/**
 * Resuelve estrategia por kind + options capturadas en apply (#156 / #154).
 * @param {{ label: string; kind?: string; options?: string[] }} question
 */
export function resolveAnswerStrategy(question) {
  const kind = String(question.kind || "text").toLowerCase();
  const label = question.label || "";
  const rawOptions = question.options || [];
  const actionable = actionableOptions(label, rawOptions);

  if (shouldUseDropdown(question, rawOptions)) {
    const opts =
      actionable.length >= 2
        ? actionable
        : isLanguageLabel(label)
          ? LANGUAGE_PROFICIENCY_OPTIONS
          : kind === "radio"
            ? YES_NO_OPTIONS
            : actionable;
    return selectStrategy(
      opts,
      actionable.length >= 2
        ? "Elegí la opción exacta del dropdown de LinkedIn."
        : isLanguageLabel(label)
          ? "Nivel de idioma (opciones típicas LinkedIn)."
          : "Sí / No del formulario."
    );
  }

  if (isYearsExperienceLabel(label) || kind === "number") {
    return yearsExperienceStrategy(label, rawOptions);
  }

  if (kind === "select" || kind === "listbox" || kind === "radio") {
    return withCapturedHint(
      textStrategy("Dropdown sin opciones útiles en DOM: escribí el texto exacto de la opción."),
      label,
      rawOptions
    );
  }

  return withCapturedHint(textStrategy(), label, rawOptions);
}
