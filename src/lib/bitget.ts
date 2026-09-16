const BITGET_TICKERS_URL = "https://api.bitget.com/api/v2/spot/market/tickers";

type BitgetTicker = {
  symbol?: string;
  lastPr?: string;
  usdtVolume?: string;
  quoteVolume?: string;
  change24h?: string;
};

type BitgetTickerResponse = {
  code?: string;
  msg?: string;
  data?: BitgetTicker[] | null;
};

export type BitgetMarketData = {
  live: boolean;
  symbol?: string;
  price?: number;
  volumeUsdt?: number;
  change24hPct?: number;
  priceLabel?: string;
  volumeLabel?: string;
  changeLabel?: string;
  summary: string;
  notice?: string;
};

function unique(values: string[]): string[] {
  return [...new Set(values.filter((value) => value.length > 0))];
}

export function bitgetSymbolCandidates(ticker: string): string[] {
  const raw = ticker.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!raw) return [];

  const base = raw.endsWith("USDT") ? raw.slice(0, -4) : raw;
  const candidates = [`${base}USDT`];

  if (!base.startsWith("R")) {
    candidates.push(`R${base}USDT`);
  } else if (base.length > 2) {
    candidates.push(`${base.slice(1)}USDT`);
  }

  return unique(candidates);
}

function formatPrice(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  if (value >= 1) {
    return value.toFixed(2);
  }

  return value.toPrecision(4);
}

function formatUsdVolume(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

function simulatedMarket(): BitgetMarketData {
  return {
    live: false,
    summary:
      "NO LIVE BITGET DATA: this ticker is not a listed Bitget rToken/spot pair. Argue from the thesis only. Do not invent prices, volume, or 24h change.",
    notice:
      "Simulated thesis without live data backing — this ticker is not listed on Bitget as an rToken/spot pair.",
  };
}

async function fetchBitgetTicker(symbol: string): Promise<BitgetTicker | null> {
  const url = `${BITGET_TICKERS_URL}?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url, {
    cache: "no-store",
    signal: AbortSignal.timeout(4000),
    headers: { Accept: "application/json" },
  });

  if (!response.ok) return null;

  const body = (await response.json()) as BitgetTickerResponse;
  if (body.code !== "00000" || !Array.isArray(body.data) || body.data.length === 0) {
    return null;
  }

  return body.data[0] ?? null;
}

export async function fetchBitgetMarket(ticker: string): Promise<BitgetMarketData> {
  try {
    for (const symbol of bitgetSymbolCandidates(ticker)) {
      const row = await fetchBitgetTicker(symbol);
      if (!row?.lastPr) continue;

      const price = Number(row.lastPr);
      if (!Number.isFinite(price)) continue;

      const volume = Number(row.usdtVolume || row.quoteVolume);
      const changeFraction = Number(row.change24h);
      const changePct = Number.isFinite(changeFraction) ? changeFraction * 100 : 0;
      const resolvedSymbol = row.symbol || symbol;
      const priceLabel = `$${formatPrice(price)}`;
      const volumeLabel = Number.isFinite(volume)
        ? formatUsdVolume(volume)
        : "n/a";
      const changeLabel = `${changePct >= 0 ? "+" : ""}${changePct.toFixed(2)}%`;

      return {
        live: true,
        symbol: resolvedSymbol,
        price,
        volumeUsdt: Number.isFinite(volume) ? volume : undefined,
        change24hPct: changePct,
        priceLabel,
        volumeLabel,
        changeLabel,
        summary: `LIVE BITGET SPOT DATA for ${resolvedSymbol}: Current price: ${priceLabel}, 24h volume: ${volumeLabel}, 24h change: ${changeLabel}. Ground every argument in this real market data. Do not invent numbers.`,
      };
    }
  } catch (error) {
    console.error("[bitget] market fetch failed:", error);
    return simulatedMarket();
  }

  return simulatedMarket();
}
