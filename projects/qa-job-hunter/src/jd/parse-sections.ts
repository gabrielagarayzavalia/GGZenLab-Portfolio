/**
 * B-38-27 (#370) — Parser de secciones JD scrapeadas (LinkedIn).
 * Extrae requirements / niceToHave / whatWeOffer desde headers EN/ES.
 */

export interface JdSections {
  requirements: string[];
  niceToHave: string[];
  whatWeOffer: string[];
  /** Texto antes de la primera sección reconocida (boilerplate, chrome). */
  preamble?: string;
}

export type JdSectionKey = keyof Pick<JdSections, "requirements" | "niceToHave" | "whatWeOffer">;

interface SectionDef {
  key: JdSectionKey;
  patterns: RegExp[];
}

const SECTION_DEFS: SectionDef[] = [
  {
    key: "requirements",
    patterns: [
      /^what\s+we(?:'|')?re\s+looking\s+for$/i,
      /^requirements?$/i,
      /^qualifications?$/i,
      /^lo\s+que\s+buscamos$/i,
      /^must[\s-]have$/i,
    ],
  },
  {
    key: "niceToHave",
    patterns: [
      /^nice\s+to\s+have$/i,
      /^preferred$/i,
      /^deseable$/i,
      /^deseables?$/i,
    ],
  },
  {
    key: "whatWeOffer",
    patterns: [
      /^what\s+we\s+offer$/i,
      /^benefits?$/i,
      /^qu[eé]\s+ofrecemos$/i,
    ],
  },
];

const ALL_HEADER_PATTERNS = SECTION_DEFS.flatMap((d) => d.patterns);

function normalizeText(text: string): string {
  return text.replace(/\r\n/g, "\n").trim();
}

function stripHeaderLine(line: string): string {
  return line.trim().replace(/:$/, "").trim();
}

function matchSectionKey(line: string): JdSectionKey | null {
  const candidate = stripHeaderLine(line);
  if (!candidate) return null;
  for (const def of SECTION_DEFS) {
    if (def.patterns.some((p) => p.test(candidate))) return def.key;
  }
  return null;
}

function isSectionHeaderLine(line: string): boolean {
  return matchSectionKey(line) !== null;
}

function parseBulletLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed || isSectionHeaderLine(trimmed)) return null;
  const bullet = trimmed
    .replace(/^[-•*–]\s+/, "")
    .replace(/^\d+[.)]\s+/, "")
    .trim();
  return bullet.length >= 3 ? bullet : null;
}

function extractBullets(sectionText: string): string[] {
  const bullets: string[] = [];
  const seen = new Set<string>();

  for (const rawLine of sectionText.split("\n")) {
    const bullet = parseBulletLine(rawLine);
    if (!bullet) continue;
    const key = bullet.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    bullets.push(bullet);
  }

  return bullets;
}

function emptySections(): JdSections {
  return { requirements: [], niceToHave: [], whatWeOffer: [] };
}

/**
 * Parsea texto JD scrapeado y devuelve secciones estructuradas.
 * Si no hay headers reconocidos, devuelve arrays vacíos y el texto completo en preamble.
 */
export function parseJdSections(rawText: string): JdSections {
  const text = normalizeText(rawText);
  if (!text) return emptySections();

  const lines = text.split("\n");
  const sections = emptySections();
  let preambleLines: string[] = [];
  let currentKey: JdSectionKey | null = null;
  /** @type {Record<JdSectionKey, string[]>} */
  const sectionLines: Record<JdSectionKey, string[]> = {
    requirements: [],
    niceToHave: [],
    whatWeOffer: [],
  };

  for (const line of lines) {
    const key = matchSectionKey(line);
    if (key) {
      currentKey = key;
      continue;
    }

    if (currentKey) {
      sectionLines[currentKey].push(line);
    } else {
      preambleLines.push(line);
    }
  }

  for (const def of SECTION_DEFS) {
    sections[def.key] = extractBullets(sectionLines[def.key].join("\n"));
  }

  const preamble = preambleLines.map((l) => l.trim()).filter(Boolean).join("\n").trim();
  if (preamble) sections.preamble = preamble;

  return sections;
}

/** Texto unificado de requisitos — consumo futuro en regex-matcher (#368). */
export function requirementsTextForMatch(sections: JdSections): string {
  return sections.requirements.join("\n");
}

/** True si al menos una sección tiene bullets. */
export function hasParsedJdSections(sections: JdSections): boolean {
  return (
    sections.requirements.length > 0 ||
    sections.niceToHave.length > 0 ||
    sections.whatWeOffer.length > 0
  );
}

/** @internal — tests */
export function isJdSectionHeader(line: string): boolean {
  return ALL_HEADER_PATTERNS.some((p) => p.test(stripHeaderLine(line)));
}
