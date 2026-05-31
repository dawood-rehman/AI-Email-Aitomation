// lib/openai.js — OpenRouter client (OpenAI-compatible API)
import OpenAI from "openai";

export const PRIMARY_MODEL =
  process.env.OPENROUTER_PRIMARY_MODEL || "openai/gpt-oss-120b:free";

export const FALLBACK_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL ||
  "meta-llama/llama-3.3-70b-instruct:free";

const openRouterApiKey = process.env.OPENROUTER_API_KEY;

if (!openRouterApiKey) {
  console.warn(
    "OPENROUTER_API_KEY is not set. AI email generation will fail until configured."
  );
}

export const openrouter = new OpenAI({
  apiKey: openRouterApiKey,
  baseURL: "https://openrouter.ai/api/v1",
  defaultHeaders: {
    "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
    "X-Title": process.env.COMPANY_NAME || "AI Email Marketing Tool",
  },
});

/** @deprecated Use `openrouter` or `createChatCompletion` */
export const openai = openrouter;

/**
 * Calls OpenRouter with primary model, then fallback model on failure.
 */
export async function createChatCompletion(params) {
  const models = [PRIMARY_MODEL, FALLBACK_MODEL];
  let lastError;

  for (const model of models) {
    try {
      return await openrouter.chat.completions.create({
        ...params,
        model,
      });
    } catch (err) {
      lastError = err;
      console.warn(`[OpenRouter] ${model} failed:`, err?.message || err);
    }
  }

  throw lastError || new Error("All OpenRouter models failed");
}
