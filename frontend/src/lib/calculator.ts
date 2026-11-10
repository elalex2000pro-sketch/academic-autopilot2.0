// Evaluador de expresiones para la calculadora integrada.
//
// No usa `eval`: tokeniza la entrada y la resuelve con un parser descendente.
// Asi una expresion escrita por el usuario nunca puede ejecutar codigo, y los
// errores se pueden explicar en castellano.

export type AngleMode = "deg" | "rad";

export class CalcError extends Error {}

type Token =
  | { kind: "number"; value: number }
  | { kind: "name"; name: string }
  | { kind: "op"; op: "+" | "-" | "*" | "/" | "^" }
  | { kind: "lparen" }
  | { kind: "rparen" }
  | { kind: "percent" };

const OPERATORS: Record<string, Token> = {
  "+": { kind: "op", op: "+" },
  "-": { kind: "op", op: "-" },
  "−": { kind: "op", op: "-" },
  "*": { kind: "op", op: "*" },
  "×": { kind: "op", op: "*" },
  "/": { kind: "op", op: "/" },
  "÷": { kind: "op", op: "/" },
  "^": { kind: "op", op: "^" },
};

const FUNCTIONS: Record<string, (value: number, mode: AngleMode) => number> = {
  sin: (value, mode) => Math.sin(toRadians(value, mode)),
  cos: (value, mode) => Math.cos(toRadians(value, mode)),
  tan: (value, mode) => Math.tan(toRadians(value, mode)),
  asin: (value, mode) => fromRadians(Math.asin(value), mode),
  acos: (value, mode) => fromRadians(Math.acos(value), mode),
  atan: (value, mode) => fromRadians(Math.atan(value), mode),
  ln: (value) => Math.log(value),
  log: (value) => Math.log10(value),
  sqrt: (value) => Math.sqrt(value),
  abs: (value) => Math.abs(value),
};

const CONSTANTS: Record<string, number> = {
  pi: Math.PI,
  e: Math.E,
};

function toRadians(value: number, mode: AngleMode): number {
  return mode === "deg" ? (value * Math.PI) / 180 : value;
}

function fromRadians(value: number, mode: AngleMode): number {
  return mode === "deg" ? (value * 180) / Math.PI : value;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let index = 0;
  while (index < input.length) {
    const char = input[index];
    if (char === " " || char === "\t") {
      index += 1;
      continue;
    }
    if (/[0-9.]/.test(char)) {
      let end = index;
      while (end < input.length && /[0-9.]/.test(input[end])) end += 1;
      const raw = input.slice(index, end);
      const value = Number(raw);
      if (!Number.isFinite(value) || (raw.match(/\./g) ?? []).length > 1) {
        throw new CalcError("Numero no valido");
      }
      tokens.push({ kind: "number", value });
      index = end;
      continue;
    }
    if (/[a-zA-Z]/.test(char)) {
      let end = index;
      while (end < input.length && /[a-zA-Z]/.test(input[end])) end += 1;
      tokens.push({ kind: "name", name: input.slice(index, end).toLowerCase() });
      index = end;
      continue;
    }
    const operator = OPERATORS[char];
    if (operator) {
      tokens.push(operator);
      index += 1;
      continue;
    }
    if (char === "(") {
      tokens.push({ kind: "lparen" });
      index += 1;
      continue;
    }
    if (char === ")") {
      tokens.push({ kind: "rparen" });
      index += 1;
      continue;
    }
    if (char === "%") {
      tokens.push({ kind: "percent" });
      index += 1;
      continue;
    }
    throw new CalcError(`Caracter no valido: ${char}`);
  }
  return tokens;
}

function parse(tokens: Token[], mode: AngleMode, ans: number): number {
  let position = 0;
  const peek = () => tokens[position];
  const next = () => tokens[position++];

  function expression(): number {
    let value = term();
    for (;;) {
      const token = peek();
      if (token?.kind === "op" && (token.op === "+" || token.op === "-")) {
        next();
        const right = term();
        value = token.op === "+" ? value + right : value - right;
        continue;
      }
      return value;
    }
  }

  function term(): number {
    let value = unary();
    for (;;) {
      const token = peek();
      if (token?.kind === "op" && (token.op === "*" || token.op === "/")) {
        next();
        const right = unary();
        if (token.op === "/" && right === 0) {
          throw new CalcError("No se puede dividir entre cero");
        }
        value = token.op === "*" ? value * right : value / right;
        continue;
      }
      return value;
    }
  }

  function unary(): number {
    const token = peek();
    if (token?.kind === "op" && (token.op === "+" || token.op === "-")) {
      next();
      const value = unary();
      return token.op === "-" ? -value : value;
    }
    return power();
  }

  function power(): number {
    const base = postfix();
    const token = peek();
    if (token?.kind === "op" && token.op === "^") {
      next();
      // Asociativa por la derecha y admite exponentes negativos: 2^-3.
      return Math.pow(base, unary());
    }
    return base;
  }

  function postfix(): number {
    let value = primary();
    while (peek()?.kind === "percent") {
      next();
      value /= 100;
    }
    return value;
  }

  function primary(): number {
    const token = next();
    if (!token) throw new CalcError("Falta terminar la operacion");
    if (token.kind === "number") return token.value;
    if (token.kind === "lparen") {
      const value = expression();
      if (next()?.kind !== "rparen") throw new CalcError("Falta cerrar un parentesis");
      return value;
    }
    if (token.kind === "name") {
      if (token.name === "ans") return ans;
      const constant = CONSTANTS[token.name];
      if (constant !== undefined) return constant;
      const fn = FUNCTIONS[token.name];
      if (!fn) throw new CalcError(`Funcion desconocida: ${token.name}`);
      if (next()?.kind !== "lparen") {
        throw new CalcError(`Escribe ${token.name}(...)`);
      }
      const argument = expression();
      if (next()?.kind !== "rparen") throw new CalcError("Falta cerrar un parentesis");
      const result = fn(argument, mode);
      if (Number.isNaN(result)) throw new CalcError("Fuera del dominio de la funcion");
      return result;
    }
    throw new CalcError("Expresion no valida");
  }

  const value = expression();
  if (position < tokens.length) throw new CalcError("Expresion no valida");
  return value;
}

/** Resuelve la expresion. Lanza `CalcError` con un mensaje legible. */
export function evaluateExpression(
  expression: string,
  mode: AngleMode = "deg",
  ans = 0,
): number {
  const trimmed = expression.trim();
  if (!trimmed) throw new CalcError("Escribe una operacion");
  const value = parse(tokenize(trimmed), mode, ans);
  if (!Number.isFinite(value)) throw new CalcError("Resultado no valido");
  return value;
}

/** Numero corto y legible: sin colas de decimales ni notacion rara. */
export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return "Error";
  if (value === 0) return "0";
  const magnitude = Math.abs(value);
  if (magnitude >= 1e12 || magnitude < 1e-9) {
    return value.toExponential(6).replace("e+", "e");
  }
  const rounded = Number(value.toPrecision(12));
  return String(rounded);
}
