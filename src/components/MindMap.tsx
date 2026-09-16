"use client";

import { GitBranch } from "lucide-react";
import type { CourtroomMessage, MarketSnapshot } from "@/components/Courtroom";

type MindMapProps = {
  ticker: string;
  market?: MarketSnapshot | null;
  messages: CourtroomMessage[];
};

function snippet(text: string, maxLength = 90): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= maxLength) return compact;
  return `${compact.slice(0, maxLength).trimEnd()}…`;
}

export function MindMap({ ticker, market, messages }: MindMapProps) {
  const bull = messages.find((message) => message.agent === "Bull");
  const bear = messages.find((message) => message.agent === "Bear");
  const judge = messages.find((message) => message.agent === "Judge");
  const hasTrial = Boolean(bull || bear || judge || market);

  const contextLabel = market?.symbol || ticker || "Ticker";
  const contextPrice = market?.live
    ? [market.priceLabel, market.changeLabel].filter(Boolean).join(" · ")
    : market?.notice
      ? "No live quote"
      : "Awaiting quote";

  return (
    <div className="flex h-full min-h-0 w-full flex-col px-4 py-5 sm:px-5">
      <div className="mb-4 flex items-center justify-center gap-2">
        <GitBranch className="h-4 w-4 text-slate-500" aria-hidden="true" />
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
          Research Mind-Map
        </p>
      </div>

      {!hasTrial ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          Run a trial to map market context, arguments, and the verdict.
        </p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center overflow-y-auto pb-2">
          <article className="w-full max-w-sm rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-cyan-400">
              Context
            </p>
            <p className="mt-1 text-sm font-semibold text-cyan-100">
              {contextLabel}
            </p>
            <p className="mt-0.5 text-xs text-cyan-200/80">{contextPrice}</p>
          </article>

          <p className="py-1 text-lg leading-none text-slate-500" aria-hidden="true">
            ↓
          </p>

          <div className="grid w-full max-w-sm grid-cols-2 gap-2">
            <article className="rounded-xl border border-green-500/30 bg-green-500/10 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-green-400">
                Bull
              </p>
              <p className="mt-1 text-xs leading-relaxed text-green-100/90">
                {bull?.text
                  ? snippet(bull.text)
                  : "Awaiting opening argument."}
              </p>
            </article>
            <article className="rounded-xl border border-red-500/30 bg-red-500/10 px-2.5 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-red-400">
                Bear
              </p>
              <p className="mt-1 text-xs leading-relaxed text-red-100/90">
                {bear?.text
                  ? snippet(bear.text)
                  : "Awaiting counter-argument."}
              </p>
            </article>
          </div>

          <p className="py-1 text-lg leading-none text-slate-500" aria-hidden="true">
            ↓
          </p>

          <article className="w-full max-w-sm rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-yellow-400">
              Judge
            </p>
            <p className="mt-1 text-sm font-semibold text-yellow-100">
              {judge?.dataChip ?? "Verdict pending"}
            </p>
            <p className="mt-0.5 text-xs text-yellow-200/80">
              Confidence Score: {judge?.confidence ?? "—"}
              {typeof judge?.confidence === "number" ? "%" : ""}
            </p>
          </article>
        </div>
      )}
    </div>
  );
}

export default MindMap;
