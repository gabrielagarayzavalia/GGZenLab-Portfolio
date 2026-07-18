// Manejo de fallos del pipeline + apertura de Playwright Codegen (con grabación a archivo).

import { spawn, spawnSync, type SpawnSyncReturns } from "child_process";
import fs from "fs";
import {
  APPLY_DIR,
  FAILURES_PATH,
  SELECTOR_TASKS_PATH,
  SELECTORS_PATH,
  resolveSessionPath,
} from "./paths.js";

export type FailureFlow = "scrape" | "easy_apply" | "login";

export interface AutomationFailure {
  flow: FailureFlow;
  jobId?: string;
  company?: string;
  title?: string;
  url?: string;
  reason: string;
  at: string;
}

const NPX_BIN = process.platform === "win32" ? "npx.cmd" : "npx";

export function recordFailure(f: Omit<AutomationFailure, "at">): AutomationFailure {
  fs.mkdirSync(APPLY_DIR, { recursive: true });
  const entry: AutomationFailure = { ...f, at: new Date().toISOString() };
  const list: AutomationFailure[] = fs.existsSync(FAILURES_PATH)
    ? JSON.parse(fs.readFileSync(FAILURES_PATH, "utf-8"))
    : [];
  list.push(entry);
  fs.writeFileSync(FAILURES_PATH, JSON.stringify(list, null, 2), "utf-8");
  return entry;
}

export function ensureSelectorWorkspace(): void {
  fs.mkdirSync(APPLY_DIR, { recursive: true });
  if (!fs.existsSync(SELECTOR_TASKS_PATH)) {
    fs.writeFileSync(
      SELECTOR_TASKS_PATH,
      `# Selector tasks — Easy Apply LinkedIn

Cuando el script falle, se abre **Playwright Codegen** para que puedas:
1. Hacer clic en el elemento correcto
2. Copiar el locator generado
3. Pegarlo en \`output/apply/selectors.json\`
4. Agregar comentarios/tareas abajo

## Flujos
- **scrape**: título, empresa, descripción, modalidad, Easy Apply
- **easy_apply**: botón Easy Apply, pasos del modal, Submit

## Tareas pendientes
| Flujo | Job ID | Empresa | Elemento | Locator sugerido | Comentario |
|-------|--------|---------|----------|------------------|------------|
| easy_apply |  |  |  |  |  |

## Notas
- Cerrá Codegen cuando termines; el script sigue en espera.
- Si LinkedIn cambió el DOM, priorizá \`getByRole\` y \`aria-label\`.
`,
      "utf-8"
    );
  }

  if (!fs.existsSync(SELECTORS_PATH)) {
    fs.writeFileSync(
      SELECTORS_PATH,
      JSON.stringify({ scrape: {}, easy_apply: {}, comments: [] }, null, 2),
      "utf-8"
    );
  }
}

export function appendTaskRow(failure: AutomationFailure): void {
  ensureSelectorWorkspace();
  const row = `| ${failure.flow} | ${failure.jobId ?? ""} | ${failure.company ?? ""} | _pendiente_ |  | ${failure.reason} |`;
  const content = fs.readFileSync(SELECTOR_TASKS_PATH, "utf-8");
  if (content.includes(row)) return;
  const updated = content.replace(
    "| easy_apply |  |  |  |  |  |",
    `| easy_apply |  |  |  |  |  |\n${row}`
  );
  fs.writeFileSync(SELECTOR_TASKS_PATH, updated, "utf-8");
}

/** Abre Playwright Codegen. Retorna status del proceso (0 = ok) cuando wait=true. */
export function openPlaywrightIde(options: {
  url: string;
  flow: FailureFlow;
  jobId?: string;
  reason?: string;
  /** Si se define, codegen guarda el script grabado en este archivo (--output). */
  outFile?: string;
  wait?: boolean;
}): number {
  ensureSelectorWorkspace();
  const session = resolveSessionPath();

  const args = [
    "playwright",
    "codegen",
    `--load-storage=${session}`,
    "--target=typescript",
    ...(options.outFile ? [`--output=${options.outFile}`] : []),
    "--viewport-size=1280,900",
    options.url,
  ];

  console.log("\n🎭 Abriendo Playwright IDE (codegen)...");
  console.log(`   Flujo: ${options.flow}`);
  if (options.jobId) console.log(`   Job: ${options.jobId}`);
  if (options.reason) console.log(`   Motivo: ${options.reason}`);
  if (options.outFile) console.log(`   Grabación → ${options.outFile}`);
  console.log("   → Seleccioná elementos; el script grabado queda en el archivo de salida.\n");

  if (options.wait) {
    const result: SpawnSyncReturns<Buffer> = spawnSync(NPX_BIN, args, {
      cwd: process.cwd(),
      stdio: "inherit",
      shell: false,
    });
    if (result.error) {
      console.error("No se pudo lanzar Playwright codegen:", result.error.message);
      return 1;
    }
    return result.status ?? 1;
  }

  const child = spawn(NPX_BIN, args, {
    cwd: process.cwd(),
    detached: true,
    stdio: "ignore",
    shell: false,
  });
  child.unref();
  return 0;
}

export function handleFailures(
  failures: Omit<AutomationFailure, "at">[],
  options: { openIde: boolean } = { openIde: true }
): void {
  if (failures.length === 0) return;

  for (const f of failures) {
    recordFailure(f);
    appendTaskRow({ ...f, at: new Date().toISOString() });
  }

  console.log(`\n⚠️  ${failures.length} fallo(s) registrados en ${FAILURES_PATH}`);

  if (!options.openIde) return;

  const first = failures.find((f) => f.url) ?? failures[0];
  if (first?.url) {
    openPlaywrightIde({
      url: first.url,
      flow: first.flow,
      jobId: first.jobId,
      reason: first.reason,
    });
  }
}
