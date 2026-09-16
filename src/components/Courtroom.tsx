"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Gavel,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

export type CourtAgent = "Bull" | "Bear" | "Judge";

export type CourtroomMessage = {
  id: string;
  agent: CourtAgent;
  text: string;
  dataChip?: string;
  confidence?: number;
  verificationHash?: string;
};

export type MarketSnapshot = {
  live: boolean;
  symbol?: string;
  priceLabel?: string;
  volumeLabel?: string;
  changeLabel?: string;
  notice?: string;
};

export type CourtroomProps = {
  messages: CourtroomMessage[];
  market?: MarketSnapshot | null;
  onExecuteTrade?: () => void;
  isExecuting?: boolean;
  executionTimestamp?: string | null;
  executionError?: string | null;
};

type AgentTheme = {
  label: string;
  Icon: LucideIcon;
  avatar: string;
  ring: string;
  name: string;
  text: string;
  bubble: string;
  chip: string;
};

const AGENT_THEME: Record<CourtAgent, AgentTheme> = {
  Bull: {
    label: "Bull — counsel for the long",
    Icon: TrendingUp,
    avatar:
      "border-green-500 text-green-400 shadow-[0_0_22px_rgba(34,197,94,0.45)]",
    ring: "bg-green-500/10",
    name: "text-green-400",
    text: "text-green-100/90",
    bubble: "border-green-500/20 bg-green-500/5",
    chip: "border-green-500/30 bg-green-500/10 text-green-300",
  },
  Bear: {
    label: "Bear — counsel for the short",
    Icon: TrendingDown,
    avatar:
      "border-red-500 text-red-400 shadow-[0_0_22px_rgba(239,68,68,0.45)]",
    ring: "bg-red-500/10",
    name: "text-red-400",
    text: "text-red-100/90",
    bubble: "border-red-500/20 bg-red-500/5",
    chip: "border-red-500/30 bg-red-500/10 text-red-300",
  },
  Judge: {
    label: "Judge — presiding",
    Icon: Gavel,
    avatar:
      "border-yellow-500 text-yellow-400 shadow-[0_0_22px_rgba(234,179,8,0.4)]",
    ring: "bg-yellow-500/10",
    name: "text-yellow-400",
    text: "text-yellow-100/90",
    bubble: "border-yellow-500/20 bg-yellow-500/5",
    chip: "border-yellow-500/30 bg-yellow-500/10 text-yellow-300",
  },
};

const BENCH_ORDER: CourtAgent[] = ["Bull", "Judge", "Bear"];

function paragraphText(text: string): string {
  return text
    .replace(/^\s*VERDICT:\s*(EXECUTE|REJECT|HOLD)\s*$/gim, "")
    .replace(/\s*VERDICT:\s*(EXECUTE|REJECT|HOLD)\s*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function AgentAvatar({ agent }: { agent: CourtAgent }) {
  const theme = AGENT_THEME[agent];
  const { Icon } = theme;

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full border-2 ${theme.ring} ${theme.avatar}`}
        aria-hidden="true"
      >
        <Icon className="h-6 w-6" strokeWidth={2.25} />
      </div>
      <span
        className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.name}`}
      >
        {agent}
      </span>
    </div>
  );
}

function formatExecutionTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return timestamp;
  return date.toLocaleString();
}

export function Courtroom({
  messages,
  market,
  onExecuteTrade,
  isExecuting = false,
  executionTimestamp = null,
  executionError = null,
}: CourtroomProps) {
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const log = logRef.current;
    if (!log) return;
    log.scrollTo({ top: log.scrollHeight, behavior: "smooth" });
  }, [messages]);

  return (
    <section
      aria-label="Live Courtroom"
      className="flex h-full min-h-0 flex-col"
    >
      <div className="border-b border-slate-800/80 px-4 py-5 sm:px-6">
        <p className="mb-4 text-center text-[11px] font-medium uppercase tracking-[0.28em] text-slate-500">
          The Bench
        </p>
        <div
          className="flex items-start justify-center gap-10 sm:gap-16"
          role="list"
          aria-label="Courtroom agents"
        >
          {BENCH_ORDER.map((agent) => (
            <div key={agent} role="listitem" aria-label={AGENT_THEME[agent].label}>
              <AgentAvatar agent={agent} />
            </div>
          ))}
        </div>
      </div>

      {market ? (
        <div
          className={`border-b px-4 py-3 sm:px-6 ${
            market.live
              ? "border-emerald-500/20 bg-emerald-500/5"
              : "border-amber-500/20 bg-amber-500/5"
          }`}
        >
          {market.live ? (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-400">
                Live Bitget data{market.symbol ? ` · ${market.symbol}` : ""}
              </p>
              <p className="mt-1 text-sm text-emerald-100/90">
                {[
                  market.priceLabel ? `Price ${market.priceLabel}` : null,
                  market.volumeLabel ? `24h vol ${market.volumeLabel}` : null,
                  market.changeLabel ? `24h ${market.changeLabel}` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ) : (
            <p className="text-sm text-amber-200" role="status">
              {market.notice ??
                "Simulated thesis without live data backing — this ticker is not listed on Bitget."}
            </p>
          )}
        </div>
      ) : null}

      <div
        ref={logRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Live courtroom transcript"
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-6"
      >
        {messages.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">
            Awaiting opening arguments…
          </p>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((message) => {
              const theme = AGENT_THEME[message.agent];

              return (
                <motion.article
                  key={message.id}
                  layout
                  initial={{ opacity: 0, y: 18 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  aria-label={`${message.agent} said`}
                  className={`rounded-xl border px-3.5 py-3 ${theme.bubble}`}
                >
                  <p
                    className={`text-[11px] font-semibold uppercase tracking-[0.16em] ${theme.name}`}
                  >
                    {message.agent}
                  </p>
                  <p
                    className={`mt-1.5 text-sm leading-relaxed ${theme.text}`}
                  >
                    {paragraphText(message.text)}
                  </p>
                  {message.dataChip ? (
                    <span
                      className={`mt-2.5 inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide ${theme.chip}`}
                    >
                      {message.dataChip}
                    </span>
                  ) : null}
                  {message.agent === "Judge" ? (
                    <div className="mt-3 space-y-3">
                      <p className="text-sm font-medium text-yellow-200">
                        Confidence Score: {message.confidence ?? 50}%
                      </p>
                      <p className="break-all font-mono text-[11px] leading-relaxed text-slate-400">
                        Verification Hash:{" "}
                        {message.verificationHash ?? `0x${"0".repeat(40)}`}
                      </p>
                      {executionTimestamp ? (
                        <div className="space-y-1.5">
                          <span className="inline-flex w-full items-center justify-center rounded-lg border border-emerald-400/40 bg-emerald-500/15 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-emerald-300">
                            ✓ Trade Executed
                          </span>
                          <p className="text-center text-[11px] text-emerald-200/80">
                            {formatExecutionTime(executionTimestamp)}
                          </p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <button
                            type="button"
                            onClick={() => {
                              void onExecuteTrade?.();
                            }}
                            disabled={isExecuting}
                            className="w-full rounded-lg border border-emerald-300 bg-emerald-500 px-4 py-2.5 text-sm font-bold uppercase tracking-[0.14em] text-slate-950 shadow-[0_0_22px_rgba(16,185,129,0.4)] transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isExecuting ? "Executing..." : "Execute Trade"}
                          </button>
                          {executionError ? (
                            <p className="text-sm text-red-400" role="alert">
                              {executionError}
                            </p>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                </motion.article>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </section>
  );
}

export default Courtroom;
