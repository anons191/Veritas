// src/app/api/veritas/route.ts
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { webSearch }       from "@/utils/search";
import { chargeAndBurn }   from "@/utils/chargeAndBurn";   // ✅ new delegate helper
import { countTokens }     from "@/utils/countTokens";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

/* ────────────────────────── pricing constants ────────────────────────── */
// mock Veritas price for dev: $10 000 mcap / 1 000 000 000 supply
const MOCK_VERITAS_PRICE_USD = 0.00001;

// GPT-4 prices (USD / 1 K tokens).  adjust if you swap models
const PRICE_PER_K_PROMPT     = 0.03;
const PRICE_PER_K_COMPLETION = 0.06;

/* ────────────────────────────── handler ─────────────────────────────── */
export async function POST(req: NextRequest) {
  const { input, mode, search, walletAddress } = await req.json();

  if (!walletAddress || typeof input !== "string") {
    return NextResponse.json(
      { error: "Missing wallet address or input." },
      { status: 400 }
    );
  }

  /* ---------- 1️⃣ (optional) web search ---------- */
  let searchContext = "";
  if (search) {
    try {
      const results = await webSearch(input);
      if (results.length) {
        searchContext =
          "\n\nRelevant Web Results:\n" +
          results
            .map(
              (r: any, i: number) => `${i + 1}. ${r.title} — ${r.url}\n"${r.snippet}"`
            )
            .join("\n\n");
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  /* ---------- 2️⃣ prompt engineering ---------- */
  const SYSTEM_PROMPTS: Record<string, string> = {
    truth:   "You are Veritas, an AI that delivers only objective truth. Be direct, avoid opinion, and source your facts.",
    bias:    "You are Veritas Bias Mode. Identify assumptions, emotional reasoning, and cognitive biases in the user's statement.",
    steelman:"You are Veritas Steelman Mode. Interpret the user charitably and make the strongest possible version of their point.",
    audit:   "You are Veritas Audit Mode. Break down the user's statement into verifiable facts, assumptions, and emotions.",
  };

  const systemPrompt = SYSTEM_PROMPTS[mode] ?? SYSTEM_PROMPTS.truth;
  const fullPrompt   = `${systemPrompt}\n${searchContext}\n\nUser input: ${input}\nVeritas:`;

  /* ---------- 3️⃣ estimate cost + charge ---------- */
  const promptTokens         = await countTokens(fullPrompt, "gpt-4");
  const maxCompletionTokens  = 300;                               // budget

  const usdCost =
      (promptTokens        / 1000) * PRICE_PER_K_PROMPT +
      (maxCompletionTokens / 1000) * PRICE_PER_K_COMPLETION;

  const usdWithMarkup       = usdCost * 2;                        // 2× markup
  const veritasNeeded       = Math.ceil(usdWithMarkup / MOCK_VERITAS_PRICE_USD);

  const chargeRes = await chargeAndBurn(walletAddress, veritasNeeded);
  if (!chargeRes.success) {
    return NextResponse.json({ error: chargeRes.message }, { status: 402 });
  }

  /* ---------- 4️⃣ OpenAI call ---------- */
  const completion = await openai.chat.completions.create({
    model:       "gpt-4",
    messages:    [{ role: "system", content: fullPrompt }],
    max_tokens:  maxCompletionTokens,
    temperature: 0.3,
  });

  const resultText = completion.choices[0]?.message?.content ?? "No response generated.";

  /* ---------- 5️⃣ respond ---------- */
  return NextResponse.json({
    result: resultText,
    usage: {
      prompt_tokens:     promptTokens,
      completion_tokens: completion.usage?.completion_tokens ?? maxCompletionTokens,
      usd_charged:       usdWithMarkup.toFixed(6),
      veritas_burned:    veritasNeeded,
    },
  });
}

