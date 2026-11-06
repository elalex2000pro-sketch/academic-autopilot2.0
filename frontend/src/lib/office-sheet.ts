// Hoja de calculo de Academic-Office: modelo, motor de formulas y exportacion.
//
// Es codigo puro (sin DOM) para poder probarlo con Node y razonar sobre el sin
// montar la interfaz. Soporta referencias A1, rangos, + - * / parentesis y las
// funciones SUM, AVERAGE, MIN, MAX, COUNT, ABS, ROUND y SQRT.

export const SHEET_ROWS = 30;
export const SHEET_COLS = 10;

export type CellMap = Record<string, string>;

export interface CellComputed {
  raw: string;
  display: string;
  numeric: number | null;
  error: string | null;
}

export interface Ref {
  row: number;
  col: number;
}

export function columnLabel(index: number): string {
  let label = "";
  let value = index + 1;
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

export function cellKey(row: number, col: number): string {
  return `${columnLabel(col)}${row + 1}`;
}

/** "B3" -> { row: 2, col: 1 }. Devuelve null si no es una referencia valida. */
export function parseCellRef(value: string): Ref | null {
  const match = /^([A-Za-z]+)(\d+)$/.exec(value.trim());
  if (!match) return null;
  let col = 0;
  for (const character of match[1].toUpperCase()) {
    col = col * 26 + (character.charCodeAt(0) - 64);
  }
  const row = Number(match[2]);
  if (!Number.isInteger(row) || row < 1) return null;
  return { row: row - 1, col: col - 1 };
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "#NUM!";
  const rounded = Math.round(value * 1e10) / 1e10;
  return Object.is(rounded, -0) ? "0" : String(rounded);
}

function expandRange(from: string, to: string): string[] {
  const start = parseCellRef(from);
  const end = parseCellRef(to);
  if (!start || !end) throw new Error("#REF!");
  const top = Math.min(start.row, end.row);
  const bottom = Math.max(start.row, end.row);
  const left = Math.min(start.col, end.col);
  const right = Math.max(start.col, end.col);
  if ((bottom - top + 1) * (right - left + 1) > 5000) throw new Error("#REF!");
  const keys: string[] = [];
  for (let row = top; row <= bottom; row += 1) {
    for (let col = left; col <= right; col += 1) keys.push(cellKey(row, col));
  }
  return keys;
}

type Resolver = (reference: string) => number;

class FormulaParser {
  private index = 0;

  constructor(
    private readonly source: string,
    private readonly resolve: Resolver,
  ) {}

  parse(): number {
    const value = this.expression();
    this.skipSpaces();
    if (this.index < this.source.length) throw new Error("#ERROR!");
    return value;
  }

  private skipSpaces(): void {
    while (/\s/.test(this.source[this.index] ?? "")) this.index += 1;
  }

  private expression(): number {
    let value = this.term();
    for (;;) {
      this.skipSpaces();
      const operator = this.source[this.index];
      if (operator !== "+" && operator !== "-") return value;
      this.index += 1;
      const right = this.term();
      value = operator === "+" ? value + right : value - right;
    }
  }

  private term(): number {
    let value = this.unary();
    for (;;) {
      this.skipSpaces();
      const operator = this.source[this.index];
      if (operator !== "*" && operator !== "/") return value;
      this.index += 1;
      const right = this.unary();
      if (operator === "/") {
        if (right === 0) throw new Error("#DIV/0!");
        value /= right;
      } else {
        value *= right;
      }
    }
  }

  private unary(): number {
    this.skipSpaces();
    if (this.source[this.index] === "-") {
      this.index += 1;
      return -this.unary();
    }
    if (this.source[this.index] === "+") {
      this.index += 1;
      return this.unary();
    }
    return this.primary();
  }

  private primary(): number {
    this.skipSpaces();
    const character = this.source[this.index];

    if (character === "(") {
      this.index += 1;
      const value = this.expression();
      this.skipSpaces();
      if (this.source[this.index] !== ")") throw new Error("#ERROR!");
      this.index += 1;
      return value;
    }

    const number = /^\d+(?:\.\d+)?/.exec(this.source.slice(this.index));
    if (number) {
      this.index += number[0].length;
      return Number(number[0]);
    }

    const reference = /^[A-Za-z]+\d+/.exec(this.source.slice(this.index));
    if (reference) {
      this.index += reference[0].length;
      return this.resolve(reference[0].toUpperCase());
    }

    const identifier = /^[A-Za-z]+/.exec(this.source.slice(this.index));
    if (identifier) {
      this.index += identifier[0].length;
      this.skipSpaces();
      if (this.source[this.index] !== "(") throw new Error("#NAME?");
      return this.call(identifier[0].toUpperCase());
    }

    throw new Error("#ERROR!");
  }

  private call(name: string): number {
    this.index += 1; // consume "("
    const args: number[] = [];
    this.skipSpaces();
    if (this.source[this.index] === ")") {
      this.index += 1;
      return this.apply(name, args);
    }
    for (;;) {
      this.skipSpaces();
      const range = /^([A-Za-z]+\d+):([A-Za-z]+\d+)/.exec(
        this.source.slice(this.index),
      );
      if (range) {
        this.index += range[0].length;
        for (const key of expandRange(range[1], range[2])) {
          args.push(this.resolve(key));
        }
      } else {
        args.push(this.expression());
      }
      this.skipSpaces();
      const character = this.source[this.index];
      if (character === ",") {
        this.index += 1;
        continue;
      }
      if (character === ")") {
        this.index += 1;
        break;
      }
      throw new Error("#ERROR!");
    }
    return this.apply(name, args);
  }

  private apply(name: string, args: number[]): number {
    switch (name) {
      case "SUM":
        return args.reduce((total, value) => total + value, 0);
      case "AVERAGE":
        return args.length
          ? args.reduce((total, value) => total + value, 0) / args.length
          : 0;
      case "MIN":
        return args.length ? Math.min(...args) : 0;
      case "MAX":
        return args.length ? Math.max(...args) : 0;
      case "COUNT":
        return args.length;
      case "ABS":
        return Math.abs(args[0] ?? 0);
      case "SQRT":
        return Math.sqrt(args[0] ?? 0);
      case "ROUND": {
        const [value, digits = 0] = args;
        const factor = 10 ** digits;
        return Math.round(value * factor) / factor;
      }
      default:
        throw new Error("#NAME?");
    }
  }
}

/** Calcula todas las celdas de una hoja, detectando referencias circulares. */
export function evaluateSheet(cells: CellMap): Record<string, CellComputed> {
  const memo: Record<string, CellComputed> = {};
  const visiting = new Set<string>();

  function compute(key: string): CellComputed {
    const cached = memo[key];
    if (cached) return cached;

    const raw = (cells[key] ?? "").trim();
    if (!raw) {
      const empty: CellComputed = {
        raw: "",
        display: "",
        numeric: null,
        error: null,
      };
      memo[key] = empty;
      return empty;
    }

    if (!raw.startsWith("=")) {
      const isNumber = /^-?\d+(?:[.,]\d+)?$/.test(raw);
      const numeric = isNumber ? Number(raw.replace(",", ".")) : null;
      const result: CellComputed = {
        raw,
        display: numeric === null ? raw : formatNumber(numeric),
        numeric,
        error: null,
      };
      memo[key] = result;
      return result;
    }

    if (visiting.has(key)) {
      const circular: CellComputed = {
        raw,
        display: "#CIRC!",
        numeric: null,
        error: "#CIRC!",
      };
      memo[key] = circular;
      return circular;
    }

    visiting.add(key);
    try {
      const parser = new FormulaParser(raw.slice(1), (reference) => {
        const target = compute(reference);
        if (target.error) throw new Error(target.error);
        return target.numeric ?? 0;
      });
      const value = parser.parse();
      if (!Number.isFinite(value)) throw new Error("#NUM!");
      const result: CellComputed = {
        raw,
        display: formatNumber(value),
        numeric: value,
        error: null,
      };
      memo[key] = result;
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : "#ERROR!";
      const failed: CellComputed = {
        raw,
        display: message.startsWith("#") ? message : "#ERROR!",
        numeric: null,
        error: message,
      };
      memo[key] = failed;
      return failed;
    } finally {
      visiting.delete(key);
    }
  }

  for (const key of Object.keys(cells)) compute(key);
  return memo;
}

export interface SheetStats {
  sum: number;
  average: number | null;
  count: number;
  numericCells: number;
  errorCells: number;
}

export function sheetStats(computed: Record<string, CellComputed>): SheetStats {
  const values = Object.values(computed).filter(
    (cell) => cell.numeric !== null,
  );
  const sum = values.reduce((total, cell) => total + (cell.numeric ?? 0), 0);
  return {
    sum,
    average: values.length ? sum / values.length : null,
    count: Object.values(computed).filter((cell) => cell.raw !== "").length,
    numericCells: values.length,
    errorCells: Object.values(computed).filter((cell) => cell.error).length,
  };
}

function csvEscape(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** CSV de lo visible: se recortan filas y columnas vacias del final. */
export function sheetToCsv(
  computed: Record<string, CellComputed>,
  rows = SHEET_ROWS,
  cols = SHEET_COLS,
): string {
  const lines: string[] = [];
  for (let row = 0; row < rows; row += 1) {
    const values: string[] = [];
    for (let col = 0; col < cols; col += 1) {
      values.push(csvEscape(computed[cellKey(row, col)]?.display ?? ""));
    }
    while (values.length && values[values.length - 1] === "") values.pop();
    if (values.some((value) => value !== "")) lines.push(values.join(","));
  }
  return lines.join("\n");
}

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Excel 2003 XML: lo abren Excel y LibreOffice con formato y tipos numericos.
 * Se exporta como .xls, sin dependencias externas.
 */
export function sheetToSpreadsheetMl(
  computed: Record<string, CellComputed>,
  sheetName: string,
  rows = SHEET_ROWS,
  cols = SHEET_COLS,
): string {
  const headerCells = Array.from({ length: cols }, (_, col) => {
    return `<Cell><Data ss:Type="String">${xmlEscape(columnLabel(col))}</Data></Cell>`;
  }).join("");

  const body = Array.from({ length: rows }, (_, row) => {
    const cells = Array.from({ length: cols }, (_, col) => {
      const value = computed[cellKey(row, col)];
      if (!value || value.display === "") return "<Cell/>";
      const type = value.numeric === null ? "String" : "Number";
      return `<Cell><Data ss:Type="${type}">${xmlEscape(value.display)}</Data></Cell>`;
    }).join("");
    return `<Row>${cells}</Row>`;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" ss:Size="11"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="${xmlEscape(sheetName.slice(0, 31) || "Hoja1")}">
  <Table>
   <Row>${headerCells}</Row>
   ${body}
  </Table>
 </Worksheet>
</Workbook>`;
}

/** Importa un CSV sencillo (comillas dobles, comas y saltos de linea). */
export function parseCsv(text: string): CellMap {
  const cells: CellMap = {};
  const rows: string[][] = [];
  let row: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        value += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(value);
      value = "";
    } else if (character === "\n") {
      row.push(value);
      rows.push(row);
      row = [];
      value = "";
    } else if (character !== "\r") {
      value += character;
    }
  }
  row.push(value);
  if (row.length > 1 || row[0] !== "") rows.push(row);

  rows.slice(0, SHEET_ROWS).forEach((values, rowIndex) => {
    values.slice(0, SHEET_COLS).forEach((raw, colIndex) => {
      if (raw !== "") cells[cellKey(rowIndex, colIndex)] = raw;
    });
  });
  return cells;
}
