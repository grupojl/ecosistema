/**
 * gap-normalize.ts — agrupa las preguntas sin respuesta (huecos de información, welver-domain.md §13.2).
 *
 * Dominio puro. «¿Dónde saco el permiso de obra?» y «donde saco el PERMISO de obra» deben contar como la misma pregunta.
 * No pretende ser semántico (eso lo haría la IA): solo evita duplicados triviales.
 */
export const MAX_QUESTION_CHARS = 300;
export const MIN_QUESTION_CHARS = 4;

export function normalizeQuestion(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_QUESTION_CHARS);
}

/** Una pregunta de menos de 4 caracteres («hola», «?») no es un hueco de información. */
export function isRecordableQuestion(normalized: string): boolean {
  return normalized.length >= MIN_QUESTION_CHARS;
}

export const GAP_WINDOW_DAYS = 7;

/** Inicio de la ventana de la lista semanal. */
export function weeklyWindowStart(now: Date): Date {
  return new Date(now.getTime() - GAP_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}
