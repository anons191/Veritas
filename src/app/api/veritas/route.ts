import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { webSearch } from '@/utils/search';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

export async function POST(req: NextRequest) {
  const { input, mode, search } = await req.json();

  let searchContext = "";
  if (search && typeof input === 'string') {
    try {
      const results = await webSearch(input);
      if (results.length > 0) {
        searchContext = `\n\nRelevant Web Results:\n` + results.map(
          (r, i) => `${i + 1}. ${r.title} — ${r.url}\n"${r.snippet}"`
        ).join("\n\n");
      }
    } catch (err) {
      console.error("Search failed:", err);
    }
  }

  const systemPrompt = {
    truth: "You are Veritas, an AI that delivers only objective truth. Be direct, avoid opinion, and source your facts.",
    bias: "You are Veritas Bias Mode. Identify assumptions, emotional reasoning, and cognitive biases in the user's statement.",
    steelman: "You are Veritas Steelman Mode. Interpret the user charitably and make the strongest possible version of their point.",
    audit: "You are Veritas Audit Mode. Break down the user's statement into verifiable facts, assumptions, and emotions."
  }[mode] || "You are Veritas, an AI that delivers only objective truth. Be direct, avoid opinion, and source your facts.";

  const fullPrompt = `${systemPrompt}\n${searchContext}\n\nUser input: ${input}\nVeritas:`;

  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: fullPrompt },
    ],
    temperature: 0.3,
  });

  const result = completion.choices[0]?.message?.content || 'No response generated.';
  return NextResponse.json({ result });
}

