// src/constants/openaiPricing.ts

export const OPENAI_PRICING = {
  'gpt-4': {
    prompt: 0.03 / 1000,   // $0.03 per 1K prompt tokens
    completion: 0.06 / 1000 // $0.06 per 1K completion tokens
  },
  'gpt-4-32k': {
    prompt: 0.06 / 1000,
    completion: 0.12 / 1000
  },
  'gpt-3.5-turbo': {
    prompt: 0.0015 / 1000,
    completion: 0.002 / 1000
  }
};

