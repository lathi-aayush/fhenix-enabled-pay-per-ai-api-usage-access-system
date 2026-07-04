import React, { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

const INITIAL_INPUT = 42;
const MAX_OPERAND_DIGITS = 10;

const FHE_OPS = [
  { key: "div", label: "FHE.div()", fn: (a, b) => (b === 0 ? null : a / b) },
  { key: "mul", label: "FHE.mul()", fn: (a, b) => a * b },
  { key: "sub", label: "FHE.sub()", fn: (a, b) => a - b },
  { key: "add", label: "FHE.add()", fn: (a, b) => a + b },
];

const OP_SYMBOL = { add: "+", sub: "-", mul: "×", div: "÷" };

/** ponytail: deterministic fake ciphertext — not real FHE, demo-only */
function mockHex(seed) {
  let h = 0x811c9dc5;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const full = (h >>> 0).toString(16).padStart(8, "0");
  const tail = ((h * 2654435761) >>> 0).toString(16).padStart(8, "0");
  return `0x${full}...${tail}`;
}

function formatValue(n) {
  if (!Number.isFinite(n)) return "—";
  if (Number.isInteger(n)) return String(n);
  return String(Number.parseFloat(n.toFixed(6)));
}

function DotGrid({ id = "fhe-dot-grid" }) {
  return (
    <svg
      className="absolute inset-0 w-full h-full stroke-slate-300/40 [mask-image:radial-gradient(ellipse_at_center,white,transparent_75%)]"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <defs>
        <pattern id={id} width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="1" cy="1" r="1" fill="currentColor" className="text-slate-300/60" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${id})`} />
    </svg>
  );
}

function WorkflowBox({ label, children, className = "" }) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-sm min-w-[88px] min-h-[88px] px-4 py-5 ${className}`}
    >
      {label && (
        <span className="text-[10px] font-semibold tracking-[0.18em] text-slate-400 uppercase mb-2">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}

function CalcButton({ children, onClick, variant = "num", className = "", disabled = false }) {
  const base =
    "select-none rounded-xl font-medium transition-all duration-150 active:scale-95 disabled:opacity-40 disabled:pointer-events-none";
  const variants = {
    num: "bg-slate-50 hover:bg-slate-100 text-slate-800 border border-slate-200/80 shadow-sm active:bg-slate-200",
    clear: "bg-slate-50 hover:bg-red-50 text-red-500 border border-slate-200/80 shadow-sm active:bg-red-100",
    equals:
      "bg-amber-400 hover:bg-amber-300 text-slate-900 border border-amber-500/30 shadow-md active:bg-amber-500 font-bold",
    fhe: "bg-amber-400 hover:bg-amber-300 text-slate-900 border border-amber-500/30 shadow-sm active:bg-amber-500 text-xs font-semibold tracking-tight",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export default function FheComputeWidget({ embedded = false }) {
  const calcRef = useRef(null);

  const [inputPlaintext, setInputPlaintext] = useState(INITIAL_INPUT);
  const [currentValue, setCurrentValue] = useState(INITIAL_INPUT);
  const [operand, setOperand] = useState("");
  const [expression, setExpression] = useState(`ENC(${INITIAL_INPUT})`);
  const [processing, setProcessing] = useState(false);
  const [decrypted, setDecrypted] = useState(null);
  const [error, setError] = useState(null);
  const [pulseKey, setPulseKey] = useState(0);

  const inputCipher = useMemo(() => mockHex(`input:${inputPlaintext}`), [inputPlaintext]);
  const stateCipher = useMemo(
    () => mockHex(`state:${currentValue}:${expression}`),
    [currentValue, expression]
  );

  const displayOperand = operand || "0";

  const pressDigit = useCallback((digit) => {
    setError(null);
    setDecrypted(null);
    setOperand((prev) => {
      if (prev.length >= MAX_OPERAND_DIGITS) return prev;
      if (prev === "0") return digit;
      return prev + digit;
    });
  }, []);

  const pressClear = useCallback(() => {
    setOperand("");
    setError(null);
    setDecrypted(null);
  }, []);

  const runFheOp = useCallback(
    (opKey) => {
      const op = FHE_OPS.find((o) => o.key === opKey);
      if (!op) return;

      const b = operand === "" ? 0 : Number(operand);
      if (!Number.isFinite(b)) {
        setError("Invalid operand");
        return;
      }

      const next = op.fn(currentValue, b);
      if (next === null) {
        setError("FHE.div() — divide by zero");
        return;
      }

      setProcessing(true);
      setError(null);
      setDecrypted(null);
      setPulseKey((k) => k + 1);

      const sym = OP_SYMBOL[opKey];
      const nextExpr =
        operand === ""
          ? `${expression} ${sym} 0`
          : `${expression} ${sym} ${formatValue(b)}`;

      window.setTimeout(() => {
        setCurrentValue(next);
        setExpression(nextExpr);
        setOperand("");
        setProcessing(false);
      }, 380);
    },
    [currentValue, expression, operand]
  );

  const handleEquals = useCallback(() => {
    setError(null);
    setProcessing(true);
    setPulseKey((k) => k + 1);
    window.setTimeout(() => {
      setDecrypted(formatValue(currentValue));
      setProcessing(false);
    }, 520);
  }, [currentValue]);

  const resetDemo = useCallback(() => {
    setInputPlaintext(INITIAL_INPUT);
    setCurrentValue(INITIAL_INPUT);
    setOperand("");
    setExpression(`ENC(${INITIAL_INPUT})`);
    setDecrypted(null);
    setError(null);
    setProcessing(false);
  }, []);

  function scrollToCalc() {
    calcRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className={`relative ${embedded ? "" : "overflow-hidden"}`}>
      {!embedded && <DotGrid id="fhe-dot-grid-page" />}

      <div className="relative z-10 max-w-6xl mx-auto">
        <div className="text-center mb-10 sm:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full bg-violet-100/80 border border-violet-200/60 px-4 py-1.5 text-[11px] font-semibold tracking-widest text-violet-700 uppercase">
            FHE Demo • CoFHE • Base Sepolia
          </span>
          <h2 className="mt-6 font-headline text-3xl sm:text-4xl lg:text-[3.25rem] font-bold text-slate-900 tracking-tight">
            Compute on encrypted data.
          </h2>
          <p className="mt-4 text-slate-500 text-base sm:text-lg max-w-xl mx-auto">
            Fast, private computations. Experience the next generation of secure computing.
          </p>
        </div>

        <div
          ref={calcRef}
          className="flex flex-col xl:flex-row items-center justify-center gap-4 sm:gap-6 xl:gap-5"
        >
          <WorkflowBox label="Input">
            <span className="text-3xl sm:text-4xl font-bold text-slate-900 tabular-nums">
              {inputPlaintext}
            </span>
          </WorkflowBox>

          <span className="hidden xl:block text-slate-300 text-2xl" aria-hidden>
            →
          </span>

          <div
            key={pulseKey}
            className={`flex flex-col items-center justify-center rounded-2xl bg-[#031634] text-white min-w-[100px] min-h-[100px] px-4 py-5 shadow-lg transition-transform duration-300 ${
              processing ? "scale-105 ring-2 ring-emerald-400/50" : ""
            }`}
          >
            <span className="material-symbols-outlined text-2xl text-slate-300 mb-1">memory</span>
            <span className="text-[11px] font-semibold text-center leading-tight">coFHE</span>
            <span className="text-[11px] font-semibold text-center leading-tight -mt-0.5">
              Processor
            </span>
            <div className="flex gap-1 mt-2">
              <span
                className={`w-1.5 h-1.5 rounded-full ${processing ? "bg-emerald-400 animate-pulse" : "bg-emerald-500"}`}
              />
              <span
                className={`w-1.5 h-1.5 rounded-full ${processing ? "bg-emerald-400 animate-pulse animation-delay-200" : "bg-emerald-500/70"}`}
              />
            </div>
          </div>

          <span className="hidden xl:block text-slate-300 text-2xl" aria-hidden>
            →
          </span>

          <div className="w-full max-w-[340px] rounded-3xl bg-white border border-slate-200/80 shadow-xl p-4 sm:p-5">
            <div className="rounded-xl bg-[#031634] px-4 py-3 mb-4 min-h-[88px] flex flex-col justify-center">
              <p className="font-mono text-xs sm:text-sm text-cyan-400 truncate">
                {expression}
                {operand ? ` … ${displayOperand}` : ""}
              </p>
              <p
                className={`font-mono text-lg sm:text-xl text-emerald-400 mt-1 truncate transition-opacity duration-200 ${
                  processing ? "opacity-50" : "opacity-100"
                }`}
              >
                {stateCipher}
              </p>
              {error && <p className="text-red-400 text-xs mt-1 font-mono">{error}</p>}
            </div>

            <div className="grid grid-cols-4 gap-2">
              {[
                ["1", "2", "3", "div"],
                ["4", "5", "6", "mul"],
                ["7", "8", "9", "sub"],
                ["C", "0", "=", "add"],
              ].map((row) =>
                row.map((key) => {
                  const op = FHE_OPS.find((o) => o.key === key);
                  if (op) {
                    return (
                      <CalcButton
                        key={op.key}
                        variant="fhe"
                        className="h-11"
                        onClick={() => runFheOp(op.key)}
                        disabled={processing}
                      >
                        {op.label}
                      </CalcButton>
                    );
                  }
                  if (key === "C") {
                    return (
                      <CalcButton
                        key="C"
                        variant="clear"
                        className="h-11 text-sm"
                        onClick={pressClear}
                        disabled={processing}
                      >
                        C
                      </CalcButton>
                    );
                  }
                  if (key === "=") {
                    return (
                      <CalcButton
                        key="="
                        variant="equals"
                        className="h-11 text-lg"
                        onClick={handleEquals}
                        disabled={processing}
                      >
                        =
                      </CalcButton>
                    );
                  }
                  return (
                    <CalcButton
                      key={key}
                      className="h-11 text-base"
                      onClick={() => pressDigit(key)}
                      disabled={processing}
                    >
                      {key}
                    </CalcButton>
                  );
                })
              )}
            </div>

            <p className="mt-3 text-[10px] text-slate-400 text-center">
              Type a number, then tap an FHE op. Press <strong className="text-slate-500">=</strong> to
              simulate author-key decryption.
            </p>
          </div>

          <span className="hidden xl:block text-slate-300 text-2xl" aria-hidden>
            →
          </span>

          <WorkflowBox className="min-w-[100px]">
            <span className="material-symbols-outlined text-2xl text-slate-500 mb-1">key</span>
            <span className="text-[10px] font-medium text-slate-500 text-center leading-snug">
              Decryption
              <br />
              by Author Key
            </span>
            {decrypted !== null && (
              <span className="mt-2 text-xl font-bold text-emerald-600 tabular-nums animate-[fadeInUp_0.35s_ease]">
                {decrypted}
              </span>
            )}
          </WorkflowBox>

          <span className="hidden xl:block text-slate-300 text-2xl" aria-hidden>
            →
          </span>

          <WorkflowBox label="Ciphertext">
            <div className="space-y-1.5 w-full">
              <p className="font-mono text-[10px] sm:text-xs text-blue-600 truncate">{inputCipher}</p>
              <p
                className={`font-mono text-[10px] sm:text-xs text-blue-600 truncate transition-opacity ${
                  processing ? "opacity-40" : "opacity-100"
                }`}
              >
                {stateCipher}
              </p>
            </div>
          </WorkflowBox>
        </div>

        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-center justify-center gap-3">
          {!embedded && (
            <button
              type="button"
              onClick={scrollToCalc}
              className="inline-flex items-center gap-2 rounded-xl bg-[#031634] hover:bg-[#0a2550] text-white px-8 py-3.5 text-sm font-semibold shadow-lg transition-colors active:scale-[0.98]"
            >
              Launch Live Demo
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            </button>
          )}
          <Link
            to="/dashboard/contract"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 px-6 py-3.5 text-sm font-medium transition-colors"
          >
            Real FHE wallet
            <span className="material-symbols-outlined text-lg">account_balance_wallet</span>
          </Link>
          <button
            type="button"
            onClick={resetDemo}
            className="text-sm text-slate-500 hover:text-slate-700 underline-offset-2 hover:underline"
          >
            Reset
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-slate-400 max-w-md mx-auto">
          Simulated homomorphic compute for education. Ciphertexts are deterministic mocks — connect
          your wallet on{" "}
          <Link to="/dashboard/contract" className="text-violet-600 hover:underline">
            FHE Smart Contract
          </Link>{" "}
          for real CoFHE on Base Sepolia.
        </p>
      </div>
    </div>
  );
}
