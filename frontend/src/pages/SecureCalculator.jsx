import React, { useEffect, useMemo, useState } from "react";

const SECRET_CODE = "2580";
const MAX_DIGITS = 12;

const secretFiles = [
  {
    name: "private-notes.txt",
    type: "Text",
    size: "4 KB",
    status: "Encrypted",
    preview: "Project passwords, launch checklist, and personal reminders.",
  },
  {
    name: "wallet-backup.key",
    type: "Key",
    size: "1 KB",
    status: "Locked",
    preview: "Recovery material placeholder. Keep real keys outside browser storage.",
  },
  {
    name: "photo-vault.zip",
    type: "Archive",
    size: "28 MB",
    status: "Hidden",
    preview: "Private gallery archive placeholder.",
  },
  {
    name: "contracts.pdf",
    type: "PDF",
    size: "620 KB",
    status: "Signed",
    preview: "Important agreements and personal records.",
  },
];

const buttons = [
  "AC",
  "DEL",
  "%",
  "÷",
  "7",
  "8",
  "9",
  "×",
  "4",
  "5",
  "6",
  "-",
  "1",
  "2",
  "3",
  "+",
  "+/-",
  "0",
  ".",
  "=",
];

function formatDisplay(value) {
  if (value === "Error") return value;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return "Error";
  if (Math.abs(numeric) > 999999999999) return numeric.toExponential(6);
  return String(Number.parseFloat(numeric.toPrecision(12)));
}

function calculate(left, operator, right) {
  const a = Number(left);
  const b = Number(right);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return "Error";

  switch (operator) {
    case "+":
      return formatDisplay(a + b);
    case "-":
      return formatDisplay(a - b);
    case "×":
      return formatDisplay(a * b);
    case "÷":
      return b === 0 ? "Error" : formatDisplay(a / b);
    default:
      return formatDisplay(b);
  }
}

export default function SecureCalculator() {
  const [display, setDisplay] = useState("0");
  const [storedValue, setStoredValue] = useState(null);
  const [operator, setOperator] = useState(null);
  const [waitingForValue, setWaitingForValue] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [pulse, setPulse] = useState(false);

  const folderStatus = useMemo(() => {
    if (isUnlocked) return "Folder unlocked";
    if (attempts === 0) return "Secure folder hidden";
    return attempts === 1 ? "1 failed attempt" : `${attempts} failed attempts`;
  }, [attempts, isUnlocked]);

  function flashDisplay() {
    setPulse(true);
    window.setTimeout(() => setPulse(false), 260);
  }

  function inputDigit(digit) {
    if (display === "Error") {
      setDisplay(digit);
      setWaitingForValue(false);
      return;
    }

    if (waitingForValue) {
      setDisplay(digit);
      setWaitingForValue(false);
      return;
    }

    setDisplay((current) => {
      if (current.replace("-", "").replace(".", "").length >= MAX_DIGITS) return current;
      return current === "0" ? digit : `${current}${digit}`;
    });
  }

  function inputDecimal() {
    if (display === "Error" || waitingForValue) {
      setDisplay("0.");
      setWaitingForValue(false);
      return;
    }
    if (!display.includes(".")) setDisplay((current) => `${current}.`);
  }

  function clearAll() {
    setDisplay("0");
    setStoredValue(null);
    setOperator(null);
    setWaitingForValue(false);
  }

  function deleteLast() {
    if (display === "Error" || waitingForValue) {
      setDisplay("0");
      setWaitingForValue(false);
      return;
    }
    setDisplay((current) => (current.length > 1 ? current.slice(0, -1) : "0"));
  }

  function toggleSign() {
    if (display !== "0" && display !== "Error") {
      setDisplay((current) => (current.startsWith("-") ? current.slice(1) : `-${current}`));
    }
  }

  function percent() {
    if (display !== "Error") setDisplay((current) => formatDisplay(Number(current) / 100));
  }

  function chooseOperator(nextOperator) {
    if (display === "Error") return;

    if (operator && !waitingForValue && storedValue !== null) {
      const result = calculate(storedValue, operator, display);
      setDisplay(result);
      setStoredValue(result);
    } else {
      setStoredValue(display);
    }

    setOperator(nextOperator);
    setWaitingForValue(true);
  }

  function submitEquals() {
    if (display === SECRET_CODE && !operator) {
      setIsUnlocked(true);
      setAttempts(0);
      flashDisplay();
      return;
    }

    if (display.length === SECRET_CODE.length && !operator && display !== SECRET_CODE) {
      setAttempts((current) => current + 1);
      flashDisplay();
    }

    if (!operator || storedValue === null || waitingForValue) return;

    const result = calculate(storedValue, operator, display);
    setDisplay(result);
    setStoredValue(null);
    setOperator(null);
    setWaitingForValue(true);
  }

  function handleButton(value) {
    if (/^\d$/.test(value)) inputDigit(value);
    else if (value === ".") inputDecimal();
    else if (value === "AC") clearAll();
    else if (value === "DEL") deleteLast();
    else if (value === "+/-") toggleSign();
    else if (value === "%") percent();
    else if (value === "=") submitEquals();
    else chooseOperator(value);
  }

  useEffect(() => {
    function onKeyDown(event) {
      const keyMap = {
        Enter: "=",
        Escape: "AC",
        Backspace: "DEL",
        "/": "÷",
        "*": "×",
      };
      const value = keyMap[event.key] || event.key;
      if (/^\d$/.test(value) || [".", "+", "-", "%", "÷", "×", "="].includes(value)) {
        event.preventDefault();
        handleButton(value);
      } else if (value === "AC" || value === "DEL") {
        event.preventDefault();
        handleButton(value);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  return (
    <main className="min-h-screen overflow-hidden bg-[#111612] text-[#f5f1e8]">
      <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.035)_1px,transparent_1px),linear-gradient(rgba(255,255,255,0.035)_1px,transparent_1px)] bg-[size:44px_44px]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-gradient-to-b from-[#e6c46b]/20 to-transparent" />

      <section className="relative mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-5 py-10 lg:grid-cols-[420px_1fr] lg:px-8">
        <div className="rounded-[28px] border border-[#394138] bg-[#181d19]/95 p-4 shadow-[0_30px_90px_rgba(0,0,0,0.42)] backdrop-blur">
          <div className="rounded-[22px] border border-[#343b34] bg-[#0d100e] p-5">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <p className="font-mono text-[11px] uppercase tracking-[0.32em] text-[#bca86f]">
                  Calculator
                </p>
                <h1 className="mt-1 font-headline text-xl font-semibold text-[#fff8df]">
                  VaultCalc
                </h1>
              </div>
              <div
                className={`flex h-11 w-11 items-center justify-center rounded-full border ${
                  isUnlocked
                    ? "border-[#8ed4a4] bg-[#173b22] text-[#9bf1b2]"
                    : "border-[#4c5249] bg-[#181d19] text-[#d3c68e]"
                }`}
                title={folderStatus}
              >
                <span className="material-symbols-outlined text-[22px]">
                  {isUnlocked ? "lock_open" : "lock"}
                </span>
              </div>
            </div>

            <div
              className={`mb-4 min-h-[118px] rounded-2xl border border-[#33392f] bg-[#d6cfb9] p-4 text-right shadow-inner transition-transform ${
                pulse ? "scale-[0.985]" : "scale-100"
              }`}
            >
              <p className="mb-4 font-mono text-[11px] uppercase tracking-[0.28em] text-[#4f5a4c]">
                {operator ? `${storedValue} ${operator}` : folderStatus}
              </p>
              <div className="truncate font-mono text-5xl font-semibold tracking-normal text-[#171a16]">
                {isUnlocked && display === SECRET_CODE ? "OPEN" : display}
              </div>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {buttons.map((button) => {
                const isOperator = ["÷", "×", "-", "+", "="].includes(button);
                const isUtility = ["AC", "DEL", "%", "+/-"].includes(button);

                return (
                  <button
                    key={button}
                    type="button"
                    onClick={() => handleButton(button)}
                    className={`h-16 rounded-2xl text-base font-bold transition duration-150 active:scale-95 ${
                      isOperator
                        ? "bg-[#d7ad4b] text-[#18140a] hover:bg-[#e8c369]"
                        : isUtility
                          ? "bg-[#30362f] text-[#f5efd9] hover:bg-[#3c443b]"
                          : "bg-[#20261f] text-[#fff8df] hover:bg-[#293128]"
                    }`}
                    aria-label={`Calculator ${button}`}
                  >
                    {button}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="relative">
          <div className="mb-6 max-w-2xl">
            <p className="font-mono text-xs uppercase tracking-[0.35em] text-[#d7ad4b]">
              Hidden workspace
            </p>
            <h2 className="mt-3 font-headline text-4xl font-bold leading-tight text-[#fff8df] sm:text-5xl">
              A normal calculator until the right number is entered.
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[#c9c1aa]">
              Use the keypad for everyday math. Enter the security number and press equals to open
              the private folder panel.
            </p>
          </div>

          <div className="rounded-[28px] border border-[#3b4439] bg-[#171c18]/90 p-4 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#30372f] pb-4">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#242c24] text-[#d7ad4b]">
                  <span className="material-symbols-outlined text-[22px]">folder_special</span>
                </div>
                <div>
                  <p className="text-sm font-semibold text-[#fff8df]">Secret Folder</p>
                  <p className="text-xs text-[#968f7e]">{folderStatus}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsUnlocked(false)}
                disabled={!isUnlocked}
                className="inline-flex items-center gap-2 rounded-full border border-[#485044] px-4 py-2 text-xs font-semibold text-[#d8d0ba] transition hover:bg-[#252b24] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="material-symbols-outlined text-[16px]">lock</span>
                Lock
              </button>
            </div>

            {isUnlocked ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {secretFiles.map((file) => (
                  <article
                    key={file.name}
                    className="rounded-2xl border border-[#333b32] bg-[#111612] p-4 transition hover:border-[#d7ad4b]/60"
                  >
                    <div className="mb-4 flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#263023] text-[#d7ad4b]">
                        <span className="material-symbols-outlined text-[20px]">
                          {file.type === "PDF" ? "picture_as_pdf" : "draft"}
                        </span>
                      </div>
                      <span className="rounded-full border border-[#4c5449] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.16em] text-[#a69f8e]">
                        {file.status}
                      </span>
                    </div>
                    <h3 className="truncate font-mono text-sm font-semibold text-[#fff8df]">
                      {file.name}
                    </h3>
                    <p className="mt-1 text-xs text-[#8f8878]">
                      {file.type} · {file.size}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-[#c9c1aa]">{file.preview}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="flex min-h-[286px] flex-col items-center justify-center rounded-2xl border border-dashed border-[#434c40] bg-[#101410] p-8 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-[#232a22] text-[#d7ad4b]">
                  <span className="material-symbols-outlined text-[32px]">encrypted</span>
                </div>
                <p className="font-headline text-2xl font-semibold text-[#fff8df]">
                  Folder is locked
                </p>
                <p className="mt-2 max-w-sm text-sm leading-6 text-[#a9a18f]">
                  Enter the security number on the calculator and press equals. Wrong four-digit
                  entries are counted as failed attempts.
                </p>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
