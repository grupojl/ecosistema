/**
 * csv.ts — lector de planillas CSV para la carga masiva de conocimiento (welver-domain.md §13.2 «Importación»).
 *
 * Dominio puro. Acepta coma o punto y coma (Excel en español exporta con «;»), comillas con escape «""», saltos de
 * línea dentro de un campo entre comillas, CRLF y BOM. Las columnas se reconocen por nombre (sin tildes ni mayúsculas):
 *
 *   ente | area | entidad        →  nombre del ente, o camino «Salud > Hospital» si el nombre se repite
 *   titulo | title               →  título del dato
 *   contenido | texto | content  →  texto libre
 */
export const MAX_IMPORT_ROWS = 500;
export const MAX_CONTENT_CHARS = 50_000;
export const MAX_TITLE_CHARS = 200;

/** Parte el texto en filas de campos. No interpreta encabezados. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, '');
  const delimiter = detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text.charAt(i);
    if (quoted) {
      if (ch === '"') {
        if (text.charAt(i + 1) === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') {
      quoted = true;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text.charAt(i + 1) === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (quoted) throw new CsvError('Hay un campo con comillas sin cerrar');
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

export class CsvError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CsvError';
  }
}

/** El delimitador es el más frecuente (coma o «;») en la primera línea, fuera de comillas. */
function detectDelimiter(text: string): ',' | ';' {
  let commas = 0;
  let semis = 0;
  let quoted = false;
  for (const ch of text) {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === '\n' || ch === '\r')) break;
    else if (!quoted && ch === ',') commas++;
    else if (!quoted && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

const normalizeHeader = (h: string): string =>
  h.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

const ENTITY_HEADERS = new Set(['ente', 'area', 'entidad', 'secretaria']);
const TITLE_HEADERS = new Set(['titulo', 'title']);
const CONTENT_HEADERS = new Set(['contenido', 'texto', 'content']);

export interface KnowledgeCsvRow {
  /** Número de línea del archivo (1 = encabezado). */
  line: number;
  entity: string;
  title: string;
  content: string;
}

export interface KnowledgeCsvError {
  line: number;
  message: string;
}

export interface KnowledgeCsvResult {
  rows: KnowledgeCsvRow[];
  errors: KnowledgeCsvError[];
}

export function parseKnowledgeCsv(input: string): KnowledgeCsvResult {
  const table = parseCsv(input);
  const header = table[0];
  if (!header)
    return {
      rows: [],
      errors: [{ line: 1, message: 'El archivo está vacío' }],
    };

  const names = header.map(normalizeHeader);
  const entityCol = names.findIndex((n) => ENTITY_HEADERS.has(n));
  const titleCol = names.findIndex((n) => TITLE_HEADERS.has(n));
  const contentCol = names.findIndex((n) => CONTENT_HEADERS.has(n));
  const missing = [
    entityCol < 0 && 'ente',
    titleCol < 0 && 'titulo',
    contentCol < 0 && 'contenido',
  ].filter((m): m is string => typeof m === 'string');
  if (missing.length > 0) {
    return {
      rows: [],
      errors: [{ line: 1, message: `Faltan columnas: ${missing.join(', ')}` }],
    };
  }

  const dataRows = table.slice(1);
  const rows: KnowledgeCsvRow[] = [];
  const errors: KnowledgeCsvError[] = [];
  if (dataRows.length > MAX_IMPORT_ROWS) {
    return {
      rows: [],
      errors: [
        {
          line: 1,
          message: `Máximo ${MAX_IMPORT_ROWS} filas por archivo (hay ${dataRows.length})`,
        },
      ],
    };
  }

  dataRows.forEach((cells, index) => {
    const line = index + 2;
    const entity = (cells[entityCol] ?? '').trim();
    const title = (cells[titleCol] ?? '').trim();
    const content = (cells[contentCol] ?? '').trim();
    if (!entity) return void errors.push({ line, message: 'Falta el ente' });
    if (!title) return void errors.push({ line, message: 'Falta el título' });
    if (title.length > MAX_TITLE_CHARS)
      return void errors.push({
        line,
        message: `El título supera ${MAX_TITLE_CHARS} caracteres`,
      });
    if (!content)
      return void errors.push({ line, message: 'Falta el contenido' });
    if (content.length > MAX_CONTENT_CHARS)
      return void errors.push({
        line,
        message: `El contenido supera ${MAX_CONTENT_CHARS} caracteres`,
      });
    rows.push({ line, entity, title, content });
  });
  return { rows, errors };
}
