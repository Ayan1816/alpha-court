import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type ExecuteRequestBody = {
  ticker?: unknown;
  thesis?: unknown;
  verdict?: unknown;
  confidence?: unknown;
  verificationHash?: unknown;
};

function json(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export async function POST(request: Request) {
  console.log("[api/execute] POST received");

  try {
    let body: ExecuteRequestBody = {};

    try {
      const raw = await request.text();
      if (raw) {
        body = JSON.parse(raw) as ExecuteRequestBody;
      }
    } catch {
      return json({ error: "Request body must be valid JSON." }, 400);
    }

    const ticker =
      typeof body.ticker === "string" ? body.ticker.trim().toUpperCase() : "";
    const thesis = typeof body.thesis === "string" ? body.thesis.trim() : "";

    const timestamp = new Date().toISOString();

    console.log("[api/execute] returning success", { ticker, timestamp });

    return json({
      ok: true,
      executed: true,
      ticker: ticker || null,
      thesis: thesis || null,
      verdict: typeof body.verdict === "string" ? body.verdict : null,
      confidence:
        typeof body.confidence === "number" ? body.confidence : null,
      verificationHash:
        typeof body.verificationHash === "string"
          ? body.verificationHash
          : null,
      timestamp,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : "Trade execution failed";

    console.error("[api/execute] failed", message);
    return json({ error: message }, 500);
  }
}
