// lib/openai.js — OpenRouter client (OpenAI-compatible API)
import OpenAI from "openai";

export const PRIMARY_MODEL =
  process.env.OPENROUTER_PRIMARY_MODEL || "meta-llama/llama-3.3-70b-instruct:free";

export const FALLBACK_MODEL =
  process.env.OPENROUTER_FALLBACK_MODEL ||
  "google/gemma-3-12b-it:free";

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

function contentFromParts(content) {
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (part?.type === "text" && part.text) return part.text;
        return "";
      })
      .join("");
  }
  return "";
}

function jsonFromReasoning(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return text;
  return text.slice(start, end + 1);
}

function sliceFromMarker(text, markerRegex) {
  const match = text.match(markerRegex);
  if (!match || match.index == null) return text;
  return text.slice(match.index);
}

function pickAssistantText(content, reasoning) {
  const c = contentFromParts(content).trim();
  const r = contentFromParts(reasoning).trim();

  if (c && /\bSUBJECT\s*:/i.test(c)) return c;
  if (r && /\bSUBJECT\s*:/i.test(r)) return sliceFromMarker(r, /\bSUBJECT\s*:/i);

  if (c && c.includes("{")) return c;
  if (r && r.includes("{")) return jsonFromReasoning(r);

  if (c) return c;
  if (r) return r;

  return "";
}

/**
 * Extract usable text from a chat completion (handles reasoning models,
 * structured `parsed`, multimodal content arrays, and legacy `text`).
 */
export function getCompletionText(completion) {
  const choice = completion?.choices?.[0];
  if (!choice) return "";

  const message = choice.message ?? {};

  if (message.parsed != null && typeof message.parsed === "object") {
    return JSON.stringify(message.parsed);
  }

  const text = pickAssistantText(message.content, message.reasoning);
  if (text) return text;

  if (typeof choice.text === "string" && choice.text.trim()) {
    return choice.text.trim();
  }

  return "";
}

/**
 * Calls OpenRouter with primary model, then fallback. Retries without
 * `response_format` when a model returns empty content (common with free
 * reasoning models + json_object).
 */
export async function createChatCompletion(params) {
  const models = [...new Set([PRIMARY_MODEL, FALLBACK_MODEL].filter(Boolean))];
  let lastError;

  for (const model of models) {
    const variants = [params];
    if (params.response_format) {
      const { response_format: _removed, ...withoutJsonMode } = params;
      variants.push(withoutJsonMode);
    }

    for (const variant of variants) {
      try {
        const completion = await openrouter.chat.completions.create({
          ...variant,
          model,
        });

        const text = getCompletionText(completion);
        if (text.trim()) {
          return completion;
        }

        const choice = completion?.choices?.[0];
        console.warn(
          `[OpenRouter] ${model} returned empty content`,
          {
            finish_reason: choice?.finish_reason,
            message_keys: Object.keys(choice?.message || {}),
            used_json_mode: Boolean(variant.response_format),
          }
        );
      } catch (err) {
        lastError = err;
        console.warn(`[OpenRouter] ${model} failed:`, err?.message || err);
      }
    }
  }

  throw (
    lastError ||
    new Error(
      "AI models returned no content. Try another OPENROUTER_PRIMARY_MODEL in .env (e.g. meta-llama/llama-3.3-70b-instruct:free)."
    )
  );
}
