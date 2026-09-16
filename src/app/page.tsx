"use client";

import { FormEvent, MouseEvent, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { Scale } from "lucide-react";
import Courtroom, {
  type CourtroomMessage,
  type MarketSnapshot,
} from "@/components/Courtroom";
import MindMap from "@/components/MindMap";

type DebateResponse = {
  messages?: CourtroomMessage[];
  error?: string;
  market?: MarketSnapshot;
};

const RATE_LIMIT_MESSAGE =
  "Rate limit hit. Google's API is busy, please wait a minute and try again";

function isRateLimitMessage(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    lower.includes("429") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("resource_exhausted") ||
    lower.includes("too many requests")
  );
}

function readErrorMessage(reason: unknown): string {
  if (reason instanceof Error && reason.message.trim()) {
    return isRateLimitMessage(reason.message)
      ? RATE_LIMIT_MESSAGE
      : reason.message;
  }

  if (typeof reason === "string" && reason.trim()) {
    return isRateLimitMessage(reason) ? RATE_LIMIT_MESSAGE : reason;
  }

  return "The court could not convene.";
}

export default function Home() {
  const formRef = useRef<HTMLFormElement>(null);
  const [ticker, setTicker] = useState("");
  const [thesis, setThesis] = useState("");
  const [messages, setMessages] = useState<CourtroomMessage[]>([]);
  const [market, setMarket] = useState<MarketSnapshot | null>(null);
  const [isDebating, setIsDebating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionTimestamp, setExecutionTimestamp] = useState<string | null>(
    null,
  );
  const [executionError, setExecutionError] = useState<string | null>(null);

  async function handleExecuteTrade() {
    if (executionTimestamp) return;

    const judge = messages.find((message) => message.agent === "Judge");
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 8_000);

    flushSync(() => {
      setIsExecuting(true);
      setExecutionError(null);
    });

    try {
      console.log("[execute] starting fetch /api/execute");

      const response = await fetch("/api/execute", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticker,
          thesis,
          verdict: judge?.dataChip,
          confidence: judge?.confidence,
          verificationHash: judge?.verificationHash,
        }),
        signal: controller.signal,
      });

      console.log("[execute] fetch completed", response.status);

      const raw = await response.text();
      let data: { error?: string; timestamp?: string } = {};

      if (raw) {
        try {
          data = JSON.parse(raw) as { error?: string; timestamp?: string };
        } catch {
          throw new Error(
            `Execution returned a non-JSON response (${response.status}).`,
          );
        }
      }

      if (!response.ok || !data.timestamp) {
        throw new Error(
          data.error?.trim() || "The trade could not be executed.",
        );
      }

      setExecutionTimestamp(data.timestamp);
    } catch (reason) {
      console.log("[execute] fetch failed", reason);

      const aborted =
        (reason instanceof DOMException && reason.name === "AbortError") ||
        (reason instanceof Error && reason.name === "AbortError");

      setExecutionError(
        aborted
          ? "Execution timed out. Please retry."
          : reason instanceof Error && reason.message.trim()
            ? reason.message
            : "The trade could not be executed.",
      );
    } finally {
      window.clearTimeout(timeoutId);
      setIsExecuting(false);
      console.log("[execute] loading reset");
    }
  }

  function readFormValue(name: "ticker" | "thesis", fallback: string): string {
    const form = formRef.current;
    if (!form) return fallback.trim();

    const value = new FormData(form).get(name);
    return (typeof value === "string" ? value : fallback).trim();
  }

  async function startTrial(
    event?: FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>,
  ) {
    event?.preventDefault();
    event?.stopPropagation();

    if (isDebating) return;

    const nextTicker = readFormValue("ticker", ticker);
    const nextThesis = readFormValue("thesis", thesis);

    if (!nextTicker || !nextThesis) {
      setError("Enter a ticker and an investment thesis to start the trial.");
      return;
    }

    flushSync(() => {
      setTicker(nextTicker);
      setThesis(nextThesis);
      setIsDebating(true);
      setError(null);
      setMessages([]);
      setMarket(null);
      setIsExecuting(false);
      setExecutionTimestamp(null);
      setExecutionError(null);
    });

    try {
      const response = await fetch("/api/debate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: nextTicker, thesis: nextThesis }),
      });

      const raw = await response.text();
      let data: DebateResponse = {};

      if (raw) {
        try {
          data = JSON.parse(raw) as DebateResponse;
        } catch {
          throw new Error(
            `The court returned a non-JSON response (${response.status}): ${raw.slice(0, 300)}`,
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error?.trim() ||
            `The court could not convene (HTTP ${response.status}).`,
        );
      }

      if (!Array.isArray(data.messages) || data.messages.length === 0) {
        throw new Error(
          data.error?.trim() || "The court returned no arguments.",
        );
      }

      setMessages(data.messages);
      setMarket(data.market ?? null);
    } catch (reason) {
      setError(readErrorMessage(reason));
      setMessages([]);
      setMarket(null);
    } finally {
      setIsDebating(false);
    }
  }

  const showCourtroom = messages.length > 0 && !isDebating && !error;

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-white">
      <header className="border-b border-slate-800/80 px-6 py-5 sm:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-yellow-500/20 bg-yellow-500/10">
            <Scale className="h-5 w-5 text-yellow-500" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight text-yellow-500 sm:text-2xl">
              Alpha Court
            </h1>
            <p className="text-sm text-slate-400">
              No trade executes until it survives a trial
            </p>
          </div>
        </div>
      </header>

      <main className="flex flex-1 flex-col gap-4 p-4 sm:p-6 lg:flex-row">
        <section
          aria-label="Live Courtroom"
          aria-busy={isDebating}
          className="flex min-h-[420px] flex-[7] flex-col overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
        >
          {isDebating ? (
            <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Live Courtroom
              </p>
              <p className="mt-4 animate-pulse text-base font-medium text-yellow-500">
                Summoning the agents...
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Bull, Bear, and the Risk-Judge are taking the stand.
              </p>
            </div>
          ) : showCourtroom ? (
            <Courtroom
              messages={messages}
              market={market}
              onExecuteTrade={handleExecuteTrade}
              isExecuting={isExecuting}
              executionTimestamp={executionTimestamp}
              executionError={executionError}
            />
          ) : (
            <form
              ref={formRef}
              onSubmit={startTrial}
              noValidate
              className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-5 px-6 py-8"
            >
              <div className="text-center sm:text-left">
                <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                  Live Courtroom
                </p>
                <h2 className="mt-2 text-lg font-semibold text-yellow-500">
                  File a motion
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  Enter a ticker and thesis. The bench will try the trade.
                </p>
              </div>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Ticker
                </span>
                <input
                  name="ticker"
                  value={ticker}
                  onChange={(event) => setTicker(event.target.value)}
                  placeholder="Ticker (e.g., AAPL)"
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 outline-none transition focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/40"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Investment Thesis
                </span>
                <textarea
                  name="thesis"
                  value={thesis}
                  onChange={(event) => setThesis(event.target.value)}
                  placeholder="Why should the court execute this trade?"
                  rows={5}
                  className="w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm leading-relaxed text-white placeholder:text-slate-500 outline-none transition focus:border-yellow-500 focus:ring-1 focus:ring-yellow-500/40"
                />
              </label>

              {error ? (
                <p
                  className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2.5 text-sm text-red-300"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="button"
                onClick={startTrial}
                disabled={isDebating}
                className="rounded-lg bg-yellow-500 px-4 py-3 text-sm font-semibold text-slate-950 transition hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start Trial
              </button>
            </form>
          )}
        </section>

        <aside
          aria-label="Research Mind-Map"
          className="flex min-h-[280px] flex-[3] overflow-hidden rounded-xl border border-slate-800 bg-slate-900/50"
        >
          <MindMap ticker={ticker} market={market} messages={messages} />
        </aside>
      </main>
    </div>
  );
}
