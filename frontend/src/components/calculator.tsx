"use client";

// Calculadora de la sección Documentos: panel flotante de cristal con
// operaciones básicas, funciones científicas, historial y copia del resultado.
// El cálculo vive en `lib/calculator.ts`; aquí solo está la interfaz.
import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Calculator as CalculatorIcon,
  Check,
  Copy,
  Delete,
  History,
  RotateCcw,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CalcError,
  evaluateExpression,
  formatNumber,
  type AngleMode,
} from "@/lib/calculator";
import { cn } from "@/lib/utils";

interface HistoryEntry {
  expression: string;
  result: string;
}

interface CalculatorPanelProps {
  open: boolean;
  onClose: () => void;
}

const KEY_BASE =
  "flex h-10 items-center justify-center rounded-xl border border-white/45 bg-white/55 text-[13px] font-medium text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition-colors hover:bg-white/85 active:scale-[0.97] dark:border-white/10 dark:bg-white/[0.07] dark:text-white/85 dark:hover:bg-white/[0.13]";
const KEY_OPERATOR =
  "flex h-10 items-center justify-center rounded-xl border border-[#0066FF]/25 bg-[#0066FF]/10 text-[14px] font-semibold text-[#0052cc] transition-colors hover:bg-[#0066FF]/18 active:scale-[0.97] dark:border-[#8ab9ff]/25 dark:bg-[#8ab9ff]/12 dark:text-[#b8d4ff] dark:hover:bg-[#8ab9ff]/20";
const KEY_SCIENTIFIC =
  "flex h-9 items-center justify-center rounded-xl border border-white/45 bg-white/40 text-[11.5px] font-medium text-slate-600 transition-colors hover:bg-white/75 active:scale-[0.97] dark:border-white/10 dark:bg-white/[0.05] dark:text-white/65 dark:hover:bg-white/[0.11]";

function isEditable(element: Element | null): element is HTMLElement {
  if (!element) return false;
  if (element instanceof HTMLInputElement) return element.type !== "checkbox";
  if (element instanceof HTMLTextAreaElement) return true;
  return element instanceof HTMLElement && element.isContentEditable;
}

export function CalculatorPanel({ open, onClose }: CalculatorPanelProps) {
  const [expression, setExpression] = useState("");
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [showHistory, setShowHistory] = useState(true);
  const [angle, setAngle] = useState<AngleMode>("deg");
  const [scientific, setScientific] = useState(false);
  const [copied, setCopied] = useState(false);
  const [lastAnswer, setLastAnswer] = useState(0);
  const [editableTarget, setEditableTarget] = useState<HTMLElement | null>(null);

  const copyTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const editableRef = useRef<HTMLElement | null>(null);

  const preview = useMemo(() => {
    if (!expression.trim()) return "";
    try {
      return formatNumber(evaluateExpression(expression, angle, lastAnswer));
    } catch {
      return "";
    }
  }, [expression, angle, lastAnswer]);

  const shown = result ?? preview ?? "";
  const topLine = expression && expression !== shown ? expression : "";

  useEffect(() => {
    if (!open) return;
    const capture = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (isEditable(target)) {
        editableRef.current = target;
        setEditableTarget(target);
      }
    };
    if (isEditable(document.activeElement)) {
      editableRef.current = document.activeElement;
      setEditableTarget(document.activeElement);
    }
    document.addEventListener("focusin", capture);
    return () => document.removeEventListener("focusin", capture);
  }, [open]);

  const append = useCallback((text: string) => {
    setError(null);
    setResult(null);
    setExpression((current) => current + text);
  }, []);

  const clear = useCallback(() => {
    setExpression("");
    setResult(null);
    setError(null);
  }, []);

  const backspace = useCallback(() => {
    setError(null);
    setResult(null);
    setExpression((current) => current.slice(0, -1));
  }, []);

  const equals = useCallback(() => {
    if (!expression.trim()) return;
    try {
      const value = evaluateExpression(expression, angle, lastAnswer);
      const formatted = formatNumber(value);
      setResult(formatted);
      setLastAnswer(value);
      setError(null);
      setHistory((current) =>
        [
          { expression, result: formatted },
          ...current.filter((entry) => entry.expression !== expression),
        ].slice(0, 20),
      );
    } catch (evaluateError) {
      setError(
        evaluateError instanceof CalcError ? evaluateError.message : "Expresion no valida",
      );
      setResult(null);
    }
  }, [angle, expression, lastAnswer]);

  const toggleSign = useCallback(() => {
    setError(null);
    setResult(null);
    setExpression((current) => {
      if (!current) return "-";
      if (current.startsWith("-(") && current.endsWith(")")) return current.slice(2, -1);
      if (current.startsWith("-")) return current.slice(1);
      return `-(${current})`;
    });
  }, []);

  const copyResult = useCallback(async () => {
    const value = shown || "0";
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      const area = document.createElement("textarea");
      area.value = value;
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      try {
        document.execCommand("copy");
      } catch {
        setError("No se pudo copiar");
      }
      document.body.removeChild(area);
    }
    setCopied(true);
    if (copyTimer.current) clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1600);
  }, [shown]);

  const insertResult = useCallback(() => {
    const target = editableRef.current;
    if (!target) return;
    const value = shown || "0";
    target.focus();
    if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
      const start = target.selectionStart ?? target.value.length;
      const end = target.selectionEnd ?? start;
      target.setRangeText(value, start, end, "end");
      target.dispatchEvent(new Event("input", { bubbles: true }));
      return;
    }
    document.execCommand("insertText", false, value);
  }, [shown]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as Element | null;
      if (isEditable(target)) return;
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "Enter" || event.key === "=") {
        event.preventDefault();
        equals();
        return;
      }
      if (event.key === "Backspace") {
        event.preventDefault();
        backspace();
        return;
      }
      if (/^[0-9.]$/.test(event.key)) {
        append(event.key);
        return;
      }
      if (["+", "-", "*", "/", "^", "%", "(", ")"].includes(event.key)) {
        append(event.key);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [append, backspace, equals, onClose, open]);

  useEffect(
    () => () => {
      if (copyTimer.current) clearTimeout(copyTimer.current);
    },
    [],
  );

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="calculator"
          role="dialog"
          aria-label="Calculadora"
          initial={{ opacity: 0, y: 16, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 32 }}
          className="fixed bottom-[calc(var(--mobile-nav-offset,0px)+1rem)] right-4 z-[90] flex w-[min(360px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-white/50 bg-white/70 shadow-[0_30px_80px_-32px_rgba(15,23,42,0.55)] backdrop-blur-3xl md:bottom-6 md:right-6 dark:border-white/12 dark:bg-[#0b0f18]/80"
        >
          <div className="flex items-center justify-between gap-2 border-b border-white/40 px-3 py-2.5 dark:border-white/10">
            <span className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-800 dark:text-white/85">
              <CalculatorIcon className="h-3.5 w-3.5" /> Calculadora
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setAngle((current) => (current === "deg" ? "rad" : "deg"))}
                aria-label="Cambiar entre grados y radianes"
                title="Grados / radianes"
                className="h-7 rounded-lg px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 transition-colors hover:bg-white/70 dark:text-white/50 dark:hover:bg-white/10"
              >
                {angle}
              </button>
              <button
                type="button"
                onClick={() => setScientific((current) => !current)}
                aria-pressed={scientific}
                title="Funciones cientificas"
                className={cn(
                  "h-7 rounded-lg px-2 text-[10px] font-semibold transition-colors",
                  scientific
                    ? "bg-[#0066FF]/12 text-[#0052cc] dark:bg-[#8ab9ff]/15 dark:text-[#b8d4ff]"
                    : "text-slate-500 hover:bg-white/70 dark:text-white/50 dark:hover:bg-white/10",
                )}
              >
                fx
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar calculadora"
                className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-white/70 dark:text-white/50 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="px-3 pt-2.5">
            <div className="rounded-2xl border border-white/50 bg-white/55 px-3 py-2 text-right shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] dark:border-white/10 dark:bg-white/[0.06]">
              <p className="h-4 truncate text-[10.5px] text-slate-500 dark:text-white/40">
                {topLine || "\u00a0"}
              </p>
              <p className="truncate text-[26px] font-semibold leading-8 tracking-[-0.02em] text-slate-900 dark:text-white/90">
                {shown || "0"}
              </p>
              <p className="h-4 truncate text-[10px] text-destructive">{error ?? "\u00a0"}</p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-1 px-3 py-2">
            <button
              type="button"
              onClick={() => setShowHistory((current) => !current)}
              aria-expanded={showHistory}
              className="flex items-center gap-1 text-[10.5px] font-medium text-slate-500 transition-colors hover:text-slate-800 dark:text-white/45 dark:hover:text-white/80"
            >
              <History className="h-3 w-3" /> Historial
              <span className="rounded-full bg-white/70 px-1.5 text-[9.5px] dark:bg-white/10">
                {history.length}
              </span>
            </button>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => void copyResult()}
                className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-medium text-slate-600 transition-colors hover:bg-white/70 dark:text-white/60 dark:hover:bg-white/10"
              >
                {copied ? (
                  <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3 w-3" />
                )}
                {copied ? "Copiado" : "Copiar"}
              </button>
              {editableTarget ? (
                <button
                  type="button"
                  onClick={insertResult}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-[10.5px] font-medium text-slate-600 transition-colors hover:bg-white/70 dark:text-white/60 dark:hover:bg-white/10"
                >
                  <ArrowDownToLine className="h-3 w-3" /> Insertar
                </button>
              ) : null}
            </div>
          </div>

          <div className="max-h-[132px] overflow-y-auto px-3 pb-2">
            {showHistory ? (
              history.length === 0 ? (
                <p className="pb-1 text-[10.5px] text-slate-500 dark:text-white/35">
                  Aún no hay cálculos. Pulsa = para guardar el primero.
                </p>
              ) : (
                <div className="space-y-1">
                  {history.map((entry, index) => (
                    <button
                      key={`${entry.expression}-${index}`}
                      type="button"
                      onClick={() => {
                        setExpression(entry.result);
                        setResult(null);
                        setError(null);
                      }}
                      title="Usar este resultado"
                      className="flex w-full items-center justify-between gap-2 rounded-lg px-1.5 py-1 text-right transition-colors hover:bg-white/60 dark:hover:bg-white/[0.08]"
                    >
                      <span className="truncate text-[10.5px] text-slate-500 dark:text-white/40">
                        {entry.expression}
                      </span>
                      <span className="shrink-0 text-[11.5px] font-semibold text-slate-700 dark:text-white/75">
                        = {entry.result}
                      </span>
                    </button>
                  ))}
                </div>
              )
            ) : null}
          </div>

          <div className="border-t border-white/40 px-2.5 pb-2.5 pt-2 dark:border-white/10">
            {scientific ? (
              <div className="mb-1.5 grid grid-cols-4 gap-1.5">
                {[
                  { label: "sin", value: "sin(" },
                  { label: "cos", value: "cos(" },
                  { label: "tan", value: "tan(" },
                  { label: "π", value: "pi" },
                  { label: "ln", value: "ln(" },
                  { label: "log", value: "log(" },
                  { label: "√", value: "sqrt(" },
                  { label: "e", value: "e" },
                  { label: "x²", value: "^2" },
                  { label: "xʸ", value: "^" },
                  { label: "1/x", value: "__inverse__" },
                  { label: "Ans", value: "ans" },
                ].map((key) => (
                  <button
                    key={key.label}
                    type="button"
                    onClick={() => {
                      if (key.value === "__inverse__") {
                        setError(null);
                        setResult(null);
                        setExpression((current) =>
                          current ? `1/(${current})` : "1/(",
                        );
                        return;
                      }
                      append(key.value);
                    }}
                    className={KEY_SCIENTIFIC}
                  >
                    {key.label}
                  </button>
                ))}
              </div>
            ) : null}

            <div className="grid grid-cols-4 gap-1.5">
              <button type="button" onClick={clear} className={KEY_OPERATOR}>
                C
              </button>
              <button
                type="button"
                onClick={backspace}
                aria-label="Borrar último carácter"
                className={KEY_OPERATOR}
              >
                <Delete className="h-4 w-4" />
              </button>
              <button type="button" onClick={() => append("%")} className={KEY_OPERATOR}>
                %
              </button>
              <button type="button" onClick={() => append("/")} className={KEY_OPERATOR}>
                ÷
              </button>

              {["7", "8", "9"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => append(digit)}
                  className={KEY_BASE}
                >
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => append("*")} className={KEY_OPERATOR}>
                ×
              </button>

              {["4", "5", "6"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => append(digit)}
                  className={KEY_BASE}
                >
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => append("-")} className={KEY_OPERATOR}>
                −
              </button>

              {["1", "2", "3"].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => append(digit)}
                  className={KEY_BASE}
                >
                  {digit}
                </button>
              ))}
              <button type="button" onClick={() => append("+")} className={KEY_OPERATOR}>
                +
              </button>

              <button
                type="button"
                onClick={toggleSign}
                aria-label="Cambiar de signo"
                className={KEY_BASE}
              >
                ±
              </button>
              <button type="button" onClick={() => append("0")} className={KEY_BASE}>
                0
              </button>
              <button type="button" onClick={() => append(".")} className={KEY_BASE}>
                .
              </button>
              <button
                type="button"
                onClick={equals}
                aria-label="Calcular resultado"
                className="flex h-10 items-center justify-center rounded-xl bg-[#1b1b1f] text-[15px] font-semibold text-white shadow-[0_10px_22px_-14px_rgba(0,0,0,0.9)] transition-transform hover:bg-[#2a2a31] active:scale-[0.97] dark:bg-[#e9e4f6] dark:text-[#1d1d1f] dark:hover:bg-white"
              >
                =
              </button>
            </div>

            <div className="mt-1.5 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[9.5px] text-slate-500 dark:text-white/30">
                {scientific
                  ? `Funciones · ${angle === "deg" ? "grados" : "radianes"}`
                  : "Básica · activa fx para funciones"}
              </p>
              <div className="flex shrink-0 items-center gap-1">
                {scientific ? (
                  <button
                    type="button"
                    onClick={() => {
                      append("(");
                    }}
                    className="h-6 w-6 rounded-lg text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white/70 dark:text-white/60 dark:hover:bg-white/10"
                    aria-label="Abrir paréntesis"
                  >
                    (
                  </button>
                ) : null}
                {scientific ? (
                  <button
                    type="button"
                    onClick={() => append(")")}
                    className="h-6 w-6 rounded-lg text-[11px] font-semibold text-slate-600 transition-colors hover:bg-white/70 dark:text-white/60 dark:hover:bg-white/10"
                    aria-label="Cerrar paréntesis"
                  >
                    )
                  </button>
                ) : null}
                {history.length > 0 ? (
                  <button
                    type="button"
                    onClick={() => {
                      setHistory([]);
                      setShowHistory(true);
                    }}
                    aria-label="Borrar historial"
                    title="Borrar historial"
                    className="flex h-6 items-center gap-1 rounded-lg px-1.5 text-[9.5px] text-slate-500 transition-colors hover:bg-white/70 dark:text-white/40 dark:hover:bg-white/10"
                  >
                    <RotateCcw className="h-3 w-3" /> Limpiar
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
