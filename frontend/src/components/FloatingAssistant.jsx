import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  getTopSuggestions,
  looksLikeSecret,
  matchAssistantQuery,
} from "../constants/assistantKnowledge.js";
import { goToHomeSection } from "../utils/scrollToSection.js";

const TOP_SUGGESTIONS = getTopSuggestions();

function AssistantBubble({ content, action, onAction }) {
  return (
    <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
      <p className="font-body text-[14px] text-slate-700 leading-relaxed">{content}</p>
      {action && (
        <button
          type="button"
          onClick={() => onAction(action)}
          className="mt-2.5 inline-flex items-center gap-1 text-[12px] font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {action.label}
          <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
        </button>
      )}
    </div>
  );
}

export default function FloatingAssistant() {
  const navigate = useNavigate();
  const prefersReducedMotion = useReducedMotion();
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(true);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleAction(action) {
    if (!action) return;
    if (action.type === "external") {
      window.open(action.target, "_blank", "noopener,noreferrer");
      return;
    }
    if (action.type === "scroll") {
      goToHomeSection(navigate, action.target);
      setOpen(false);
      return;
    }
    if (action.type === "route") {
      navigate(action.target);
      setOpen(false);
    }
  }

  function handleSend(text) {
    const trimmed = text.trim();
    if (!trimmed) return;

    const redacted = looksLikeSecret(trimmed);
    const result = matchAssistantQuery(trimmed);

    const userContent = redacted ? "[Message redacted for security]" : trimmed;
    const assistantMsg = {
      role: "assistant",
      content: result.content,
      action: result.type === "faq" ? result.action : undefined,
    };

    setMessages((prev) => [...prev, { role: "user", content: userContent }, assistantMsg]);
    setShowSuggestions(result.showSuggestions ?? false);
    setInput("");
  }

  function handleSubmit(e) {
    e.preventDefault();
    handleSend(input);
  }

  const panelMotion = prefersReducedMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        exit: { opacity: 0 },
        transition: { duration: 0.15 },
      }
    : {
        initial: { opacity: 0, y: 16, scale: 0.96 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: 12, scale: 0.96 },
        transition: { duration: 0.28, ease: [0.16, 1, 0.3, 1] },
      };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3 pointer-events-none">
      <AnimatePresence>
        {open && (
          <motion.div
            {...panelMotion}
            className="pointer-events-auto w-[min(380px,calc(100vw-2rem))] h-[min(480px,calc(100vh-8rem))] flex flex-col bg-white/95 backdrop-blur-md border border-slate-200/80 rounded-2xl shadow-2xl shadow-indigo-500/10 overflow-hidden"
            role="dialog"
            aria-label="Sentinal Guide chat"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200/80 bg-white/80 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 flex items-center justify-center shadow-sm">
                  <span className="material-symbols-outlined text-white text-[16px]">auto_awesome</span>
                </div>
                <div>
                  <span className="font-headline text-sm font-semibold text-slate-800 block">Sentinal Guide</span>
                  <span className="font-body text-[11px] text-slate-400">Quick answers about Sentinal</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close chat"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/40 min-h-0">
              <div className="flex justify-start">
                <div className="flex gap-2.5 max-w-[90%]">
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                    <span className="material-symbols-outlined text-indigo-500 text-[14px]">smart_toy</span>
                  </div>
                  <div className="bg-white border border-slate-200/80 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                    <p className="font-body text-[14px] text-slate-700 leading-relaxed">
                      Hi! I answer common questions about Sentinal — the Marketplace, AI Studio, Pera Wallet, and
                      pay-per-call billing. Pick a topic below or type your question.
                    </p>
                  </div>
                </div>
              </div>

              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="flex gap-2.5 max-w-[90%]">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-100 to-violet-100 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="material-symbols-outlined text-indigo-500 text-[14px]">smart_toy</span>
                      </div>
                      <AssistantBubble
                        content={msg.content}
                        action={msg.action}
                        onAction={handleAction}
                      />
                    </div>
                  )}
                  {msg.role === "user" && (
                    <div className="max-w-[85%] bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
                      <p className="font-body text-[14px] leading-relaxed">{msg.content}</p>
                    </div>
                  )}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>

            {/* Suggestions */}
            {showSuggestions && (
              <div className="px-4 pb-2 flex flex-wrap gap-2 shrink-0">
                {TOP_SUGGESTIONS.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => handleSend(entry.question)}
                    className="text-[11.5px] font-medium text-slate-600 bg-white border border-slate-200/80 rounded-full px-3 py-1.5 hover:border-indigo-300 hover:text-indigo-700 hover:bg-indigo-50/50 transition-colors"
                  >
                    {entry.question}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-3 bg-white border-t border-slate-200/80 shrink-0">
              <form onSubmit={handleSubmit} className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  className="flex-1 border border-slate-200 rounded-full px-4 py-2.5 font-body text-[13.5px] outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400/30 bg-slate-50/50 placeholder:text-slate-400"
                  placeholder="Ask about Sentinal features, marketplace, or studio…"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
                <button
                  type="submit"
                  disabled={!input.trim()}
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-900 to-indigo-950 text-white flex items-center justify-center hover:from-indigo-600 hover:to-violet-600 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                  aria-label="Send message"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB toggle */}
      <motion.button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-label={open ? "Close assistant" : "Open assistant"}
        aria-expanded={open}
        whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
        className={`pointer-events-auto relative w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 via-violet-500 to-emerald-500 text-white shadow-lg shadow-indigo-500/30 flex items-center justify-center hover:shadow-xl hover:shadow-indigo-500/40 transition-shadow duration-300 ${
          !open ? "animate-pulse-soft" : ""
        }`}
      >
        <span className="material-symbols-outlined text-[26px]">
          {open ? "close" : "smart_toy"}
        </span>
        {!open && (
          <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-400 border-2 border-white" />
        )}
      </motion.button>
    </div>
  );
}
