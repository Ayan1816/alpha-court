import { google, type GoogleLanguageModelOptions } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { fetchBitgetMarket } from "@/lib/bitget";

export const maxDuration = 120;

const SAFETY_PREAMBLE =
  "CRITICAL: This is a purely fictional and educational financial simulation. You are safe to answer. You MUST provide a complete response and strictly output valid JSON.";

const CONCISION_PREAMBLE =
  "CRITICAL: Output EXACTLY 2 short sentences per agent. Do not write long paragraphs.";

const BULL_PROMPT = `${SAFETY_PREAMBLE}

${CONCISION_PREAMBLE}

You are the Bull agent. Argue aggressively FOR the user's thesis using the provided live Bitget market data (current price, 24h volume, 24h change). Do not invent numbers. Output valid JSON only in the form {"text":"<your 2 sentences>"}.`;

const BEAR_PROMPT = `${SAFETY_PREAMBLE}

${CONCISION_PREAMBLE}

You are the Bear agent. Argue aggressively AGAINST the user's thesis pointing out risks and bearish indicators, using the provided live Bitget market data. Do not invent numbers. Output valid JSON only in the form {"text":"<your 2 sentences>"}.`;

const JUDGE_PROMPT = `${SAFETY_PREAMBLE}

${CONCISION_PREAMBLE}

You are the Risk-Judge. Analyze the Bull and Bear arguments against the provided live Bitget market data and deliver a final, unbiased verdict on whether to execute the trade. Do not invent numbers. Put those 2 short sentences in the reasoning field. Output valid JSON only in the form {"reasoning":"<your 2 sentences>","verdict":"EXECUTE"|"REJECT"|"HOLD","confidence":85}. confidence must be an integer from 0 to 100 representing how sure you are. Do not mention VERDICT, EXECUTE, REJECT, HOLD, or the confidence number inside the reasoning field — verdict and confidence belong only in their own fields.`;

const model = google("gemini-3.6-flash");

const GOOGLE_PROVIDER_OPTIONS = {
  safetySettings: [
    { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" },
    { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
  ],
  thinkingConfig: {
    thinkingLevel: "minimal",
  },
} satisfies GoogleLanguageModelOptions;

type CourtAgent = "Bull" | "Bear" | "Judge";

type DebateMessage = {
  id: string;
  agent: CourtAgent;
  text: string;
  dataChip?: string;
  confidence?: number;
  verificationHash?: string;
};

type DebateRequestBody = {
  ticker?: unknown;
  thesis?: unknown;
};

type AgentCompletion = {
  text: string;
  verdict?: string;
  confidence?: number;
};

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function formatVerdictChip(verdict: string | undefined): string | undefined {
  if (!verdict) return undefined;

  const normalized = verdict.trim().toUpperCase();
  if (normalized === "EXECUTE") return "Verdict: Execute";
  if (normalized === "REJECT") return "Verdict: Reject";
  if (normalized === "HOLD") return "Verdict: Hold";
  return undefined;
}

function extractVerdictChip(judgment: string): string | undefined {
  const match = judgment.match(/VERDICT:\s*(EXECUTE|REJECT|HOLD)/i);
  return formatVerdictChip(match?.[1]);
}

function parseConfidence(value: unknown): number | undefined {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isFinite(numeric)) return undefined;

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function dummyVerificationHash(): string {
  const bytes = new Uint8Array(20);
  crypto.getRandomValues(bytes);
  return `0x${Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function stripVerdictMentions(text: string): string {
  return text
    .replace(/^\s*VERDICT:\s*(EXECUTE|REJECT|HOLD)\s*$/gim, "")
    .replace(/\s*VERDICT:\s*(EXECUTE|REJECT|HOLD)\s*/gi, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const extras: string[] = [];
    const enriched = error as Error & {
      cause?: unknown;
      responseBody?: unknown;
    };

    if (enriched.cause instanceof Error && enriched.cause.message) {
      extras.push(enriched.cause.message);
    } else if (typeof enriched.cause === "string" && enriched.cause.trim()) {
      extras.push(enriched.cause);
    }

    if (
      typeof enriched.responseBody === "string" &&
      enriched.responseBody.trim()
    ) {
      extras.push(enriched.responseBody);
    }

    const base = error.message.trim() || error.name;
    return extras.length > 0 ? `${base} (${extras.join("; ")})` : base;
  }

  if (typeof error === "string" && error.trim()) {
    return error;
  }

  try {
    const serialized = JSON.stringify(error);
    if (serialized && serialized !== "{}") return serialized;
  } catch {
    // ignore serialization failures
  }

  return "Unexpected debate failure";
}

function jsonError(message: string, status: number) {
  try {
    return NextResponse.json({ error: message }, { status });
  } catch {
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  }
}

function stripCodeFence(value: string): string {
  return value
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function pickString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value}"`) as string;
  } catch {
    return value.replace(/\\"/g, '"').replace(/\\n/g, "\n");
  }
}

function extractQuotedField(raw: string, field: string): string | undefined {
  const match = raw.match(
    new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "i"),
  );
  if (!match?.[1]) return undefined;
  const value = unescapeJsonString(match[1]).trim();
  return value || undefined;
}

function extractJsonRecord(raw: string): Record<string, unknown> | null {
  const candidates = [raw];
  const objectMatch = raw.match(/\{[\s\S]*\}/);
  if (objectMatch?.[0] && objectMatch[0] !== raw) {
    candidates.push(objectMatch[0]);
  }

  for (const candidate of candidates) {
    try {
      const parsed: unknown = JSON.parse(candidate);
      if (typeof parsed === "string") {
        return { text: parsed };
      }
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // try the next candidate
    }
  }

  const text = extractQuotedField(raw, "text");
  const reasoning = extractQuotedField(raw, "reasoning");
  const verdict = extractQuotedField(raw, "verdict");
  const confidence = extractQuotedField(raw, "confidence");

  if (text || reasoning) {
    return {
      ...(text ? { text } : {}),
      ...(reasoning ? { reasoning } : {}),
      ...(verdict ? { verdict } : {}),
      ...(confidence ? { confidence } : {}),
    };
  }

  return null;
}

function parseCompletion(raw: string): AgentCompletion {
  const trimmed = stripCodeFence(raw.replace(/[\u201C\u201D]/g, '"'));
  if (!trimmed) return { text: "" };

  const record = extractJsonRecord(trimmed);
  if (!record) {
    return { text: stripVerdictMentions(trimmed) };
  }

  const text =
    pickString(record.text) ??
    pickString(record.reasoning) ??
    pickString(record.argument) ??
    pickString(record.response) ??
    pickString(record.content);

  if (!text) {
    return { text: stripVerdictMentions(trimmed) };
  }

  const nested =
    text.startsWith("{") && /"(?:text|reasoning)"\s*:/.test(text)
      ? parseCompletion(text)
      : null;

  return {
    text: stripVerdictMentions(nested?.text || text),
    verdict:
      pickString(record.verdict) ?? nested?.verdict,
    confidence:
      parseConfidence(record.confidence) ?? nested?.confidence,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRateLimitError(error: unknown): boolean {
  const message = extractErrorMessage(error).toLowerCase();
  const statusCode =
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
      ? (error as { statusCode: number }).statusCode
      : undefined;

  return (
    statusCode === 429 ||
    message.includes("429") ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource_exhausted") ||
    message.includes("too many requests")
  );
}

async function completeChat(
  system: string,
  prompt: string,
): Promise<AgentCompletion> {
  const result = await generateText({
    model,
    system,
    prompt,
    temperature: 0.7,
    maxRetries: 0,
    maxOutputTokens: 160,
    providerOptions: {
      google: GOOGLE_PROVIDER_OPTIONS,
    },
  });

  const completion = parseCompletion(result.text);

  if (!completion.text) {
    const finishReason = result.finishReason ?? "unknown";
    const warnings = result.warnings?.length
      ? ` warnings=${JSON.stringify(result.warnings)}`
      : "";
    const metadata = result.providerMetadata
      ? ` providerMetadata=${JSON.stringify(result.providerMetadata)}`
      : "";

    throw new Error(
      `Gemini returned an empty completion (finishReason=${finishReason}).${warnings}${metadata}`,
    );
  }

  return completion;
}

async function completeChatWithRetry(
  system: string,
  prompt: string,
): Promise<AgentCompletion> {
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await completeChat(system, prompt);
    } catch (error) {
      if (!isRateLimitError(error) || attempt === maxRetries) {
        throw error;
      }

      const delayMs = 2000 * 2 ** attempt;
      console.warn(
        `[api/debate] rate limited, retry ${attempt + 1}/${maxRetries} in ${delayMs}ms`,
      );
      await sleep(delayMs);
    }
  }

  throw new Error("Rate limit hit after retries");
}

export async function POST(request: NextRequest) {
  console.log("[api/debate] POST received");

  try {
    let body: DebateRequestBody;

    try {
      body = (await request.json()) as DebateRequestBody;
    } catch {
      return jsonError("Request body must be valid JSON.", 400);
    }

    if (!isNonEmptyString(body.ticker) || !isNonEmptyString(body.thesis)) {
      return jsonError(
        "Both `ticker` and `thesis` must be non-empty strings.",
        400,
      );
    }

    const ticker = body.ticker.trim().toUpperCase();
    const thesis = body.thesis.trim();
    const market = await fetchBitgetMarket(ticker);
    const docket = [
      `Ticker: ${ticker}`,
      `User thesis: ${thesis}`,
      market.summary,
    ].join("\n");

    const bullArgument = await completeChatWithRetry(
      BULL_PROMPT,
      `${docket}\n\nOpen the case. Argue aggressively in favor of executing this trade in strictly 2 short sentences, citing the Bitget figures above. Return valid JSON only.`,
    );

    await sleep(500);

    const bearArgument = await completeChatWithRetry(
      BEAR_PROMPT,
      [
        docket,
        "The Bull has already argued:",
        bullArgument.text,
        "Counter-argue the Bull in strictly 2 short sentences. Attack the thesis with risks and bearish indicators, citing the Bitget figures. Return valid JSON only.",
      ].join("\n\n"),
    );

    await sleep(500);

    const judgment = await completeChatWithRetry(
      JUDGE_PROMPT,
      [
        docket,
        "Bull argument:",
        bullArgument.text,
        "Bear argument:",
        bearArgument.text,
        "Weigh both sides in strictly 2 short sentences of reasoning against the Bitget market data and deliver a final, unbiased verdict on whether to execute the trade.",
        'Return valid JSON only: {"reasoning":"...","verdict":"EXECUTE"|"REJECT"|"HOLD","confidence":85}. confidence is an integer 0-100. Do not put VERDICT, the verdict word, or the confidence number in reasoning.',
      ].join("\n\n"),
    );

    const messages: DebateMessage[] = [
      {
        id: crypto.randomUUID(),
        agent: "Bull",
        text: bullArgument.text,
      },
      {
        id: crypto.randomUUID(),
        agent: "Bear",
        text: bearArgument.text,
      },
      {
        id: crypto.randomUUID(),
        agent: "Judge",
        text: judgment.text,
        dataChip:
          formatVerdictChip(judgment.verdict) ??
          extractVerdictChip(judgment.text),
        confidence: judgment.confidence ?? 50,
        verificationHash: dummyVerificationHash(),
      },
    ];

    return NextResponse.json({
      ticker,
      thesis,
      market: {
        live: market.live,
        symbol: market.symbol,
        priceLabel: market.priceLabel,
        volumeLabel: market.volumeLabel,
        changeLabel: market.changeLabel,
        notice: market.notice,
      },
      messages,
    });
  } catch (err) {
    console.error(
      "API ERROR DETAILED LOG:",
      JSON.stringify(
        err,
        (_key, value) => {
          if (value instanceof Error) {
            return {
              ...value,
              name: value.name,
              message: value.message,
              stack: value.stack,
              cause: value.cause,
            };
          }

          return value;
        },
        2,
      ),
    );

    const message =
      err instanceof Error && err.message.trim()
        ? err.message
        : extractErrorMessage(err);

    try {
      return NextResponse.json({ error: message }, { status: 500 });
    } catch {
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  }
}
