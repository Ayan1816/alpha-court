# ⚖️ Alpha Court

**No trade executes until it survives a trial.**

Alpha Court is an AI-powered trading courtroom built for the **Bitget AI Hackathon S2**. Instead of a single AI giving you a buy/sell signal, three adversarial AI agents — **Bull**, **Bear**, and **Judge** — debate every trade thesis live, backed by real Bitget market data, before a human makes the final call.

## 🎯 Hackathon Tracks Covered

This project spans all three Bitget AI Hackathon S2 tracks:

- **📈 Alpha Factory** — Bull and Bear arguments are grounded in live Bitget price, volume, and 24h change data, not guesswork.
- **🤖 Agentic Trading** — Three independent AI agents sense the market, reason about it, and the Judge applies risk-aware verdicts (Execute / Hold / Reject).
- **🧠 AI Trading Desk** — The full debate is shown in natural language, and a human always makes the final "Execute Trade" decision — the AI never trades on its own.

## ✨ Features

- **Live Courtroom** — Submit a ticker + investment thesis, watch Bull and Bear argue it out in real time.
- **Live Bitget Data** — Real price, 24h volume, and 24h change pulled directly from Bitget's public market API.
- **Judge Verdict** — A confidence score, a clear verdict (Execute / Hold / Reject), and a verification hash for the trial.
- **Research Mind-Map** — A visual breakdown of the trial: market context → Bull vs Bear → Judge's merged verdict.
- **Execute Trade** — Human-in-the-loop confirmation before anything is marked as executed.

- ## 🛠️ Tech Stack

- **Next.js** (React, TypeScript)
- **Gemini API** — powers the Bull, Bear, and Judge agents
- **Bitget Public Market API** — live price/volume data
- Tailwind CSS for styling

## 🚀 Getting Started

```bash
npm install
npm run dev
Open http://localhost:3000 to see Alpha Court running locally.
🏗️ How It Works
Enter a ticker (e.g. SOLUSDT, NVDA) and your investment thesis
Alpha Court fetches live Bitget market data for that ticker
The Bull agent argues for the trade, the Bear agent argues against it — both using the real market data
The Judge weighs both arguments and returns a verdict with a confidence score and a verification hash
A human reviews everything and can choose to Execute Trade
👤 Author
Built by Ayan
