/**
 * Strategy pattern — widget de respuesta en Config Preguntas (#97 / #241).
 * select con opciones → dropdown; radio Sí/No → select; resto → texto libre.
 */

const EMPTY_OPTION_RE =
  /^(select an option|seleccion(a|á)|choose|eleg[ií]|pick\b|selecciona una opci)/i;

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

function cleanOptions(raw) {
  return [...new Set((raw || []).map((o) => String(o).trim()).filter(Boolean))]
    .filter((o) => !EMPTY_OPTION_RE.test(o))
    .slice(0, 40);
}

function isYesNoOptions(options) {
  const norm = options.map((o) => o.toLowerCase());
  return norm.includes("sí") || norm.includes("si") || norm.includes("yes");
}

function isLanguageLabel(label) {
  return /portugu|ingl[eé]s|idioma|language|proficiency|nivel|franc[eé]s|alem[aá]n|italiano/i.test(
    label || ""
  );
}

function selectStrategy(options, hint) {
  const opts = cleanOptions(options);
  return {
    id: "select",
    hint: hint || "Elegí la opción exacta del dropdown de LinkedIn.",
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
        if (currentAnswer && currentAnswer === o) opt.selected = true;
        sel.appendChild(opt);
      }
      label.append(span, sel);
      container.appendChild(label);
    },
    readValue(container) {
      const sel = container.querySelector("select[name=answer]");
      return sel?.value?.trim() || "";
    },
  };
}

function textStrategy(hint) {
  return {
    id: "text",
    hint: hint || "Texto libre (debe coincidir con lo que acepta el formulario).",
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
      input.value = currentAnswer || "";
      label.append(span, input);
      container.appendChild(label);
    },
    readValue(container) {
      const input = container.querySelector("input[name=answer]");
      return input?.value?.trim() || "";
    },
  };
}

function numberStrategy() {
  return {
    id: "number",
    hint: "Número (años, cantidad, etc.).",
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
      input.value = currentAnswer || "";
      label.append(span, input);
      container.appendChild(label);
    },
    readValue(container) {
      const input = container.querySelector("input[name=answer]");
      return input?.value?.trim() || "";
    },
  };
}

/**
 * Resuelve estrategia por kind + options capturadas en apply (#156 / #154).
 * @param {{ label: string; kind?: string; options?: string[] }} question
 */
export function resolveAnswerStrategy(question) {
  const kind = String(question.kind || "text").toLowerCase();
  const options = cleanOptions(question.options);
  const label = question.label || "";

  if (options.length >= 2) {
    if (options.length <= 3 && isYesNoOptions(options)) {
      return selectStrategy(options, "Sí / No del formulario.");
    }
    return selectStrategy(options);
  }

  if (kind === "select" || kind === "listbox" || kind === "radio") {
    if (isLanguageLabel(label)) {
      return selectStrategy(LANGUAGE_PROFICIENCY_OPTIONS, "Nivel de idioma (opciones típicas LinkedIn).");
    }
    if (kind === "radio") {
      return selectStrategy(YES_NO_OPTIONS, "Sí / No.");
    }
    return {
      ...textStrategy("Dropdown sin opciones capturadas: pegá el texto exacto de la opción."),
      id: "select-fallback",
    };
  }

  if (kind === "number" || kind === "tel") {
    return numberStrategy();
  }

  return textStrategy();
}
