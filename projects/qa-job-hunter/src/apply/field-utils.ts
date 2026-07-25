/** Utilidades de campos EA sin depender de fill-answers (evita ciclos ESM). */

export const EMPTY_SELECT_RE =
  /select an option|seleccion(a|á)|selecciona una opci|choose|eleg[ií]|elegir/i;

/** ¿Ya hay respuesta usable? (no placeholder de select vacío). */
export function hasPrefillValue(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  if (EMPTY_SELECT_RE.test(v)) return false;
  return true;
}
