// src/utils/countTokens.ts
/* eslint-disable @next/next/no-server-import-in-page */
"use server";

import { encoding_for_model } from "tiktoken-node";

export async function countTokens(text: string, model = "gpt-4"): Promise<number> {
  const enc = await encoding_for_model(model);
  const tokens = enc.encode(text);
  enc.free();
  return tokens.length;
}

