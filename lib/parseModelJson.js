/**
 * Parse JSON from LLM output. Models often return markdown fences or
 * invalid JSON when values contain unescaped quotes (e.g. HTML in body_html).
 */

function stripCodeFences(text) {
  let trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
  if (fenced) return fenced[1].trim();
  if (trimmed.startsWith("```")) {
    trimmed = trimmed.replace(/^```(?:json)?\n?/i, "").replace(/\n?```$/i, "").trim();
  }
  return trimmed;
}

function tryParse(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Escape control chars inside a JSON string segment (best-effort repair). */
function repairJsonStringLiterals(text) {
  let result = "";
  let i = 0;
  let inString = false;
  let escaped = false;

  while (i < text.length) {
    const ch = text[i];

    if (!inString) {
      result += ch;
      if (ch === '"') {
        inString = true;
        escaped = false;
      }
      i += 1;
      continue;
    }

    if (escaped) {
      result += ch;
      escaped = false;
      i += 1;
      continue;
    }

    if (ch === "\\") {
      result += ch;
      escaped = true;
      i += 1;
      continue;
    }

    if (ch === '"') {
      const rest = text.slice(i + 1).trimStart();
      if (rest.startsWith(",") || rest.startsWith("}") || rest.startsWith("]")) {
        result += ch;
        inString = false;
        i += 1;
        continue;
      }
      result += '\\"';
      i += 1;
      continue;
    }

    if (ch === "\n") {
      result += "\\n";
      i += 1;
      continue;
    }

    if (ch === "\r") {
      i += 1;
      continue;
    }

    if (ch === "\t") {
      result += "\\t";
      i += 1;
      continue;
    }

    result += ch;
    i += 1;
  }

  return result;
}

function extractJsonObject(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function extractFieldString(text, field) {
  const re = new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "s");
  const match = text.match(re);
  if (match) {
    try {
      return JSON.parse(`"${match[1]}"`);
    } catch {
      return match[1]
        .replace(/\\n/g, "\n")
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, "\\");
    }
  }

  if (field !== "body_html") return null;

  const marker = `"${field}"`;
  const keyIndex = text.indexOf(marker);
  if (keyIndex === -1) return null;

  const colonIndex = text.indexOf(":", keyIndex + marker.length);
  if (colonIndex === -1) return null;

  let i = colonIndex + 1;
  while (i < text.length && /\s/.test(text[i])) i += 1;
  if (text[i] !== '"') return null;

  i += 1;
  let content = "";
  while (i < text.length) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      content += text[i + 1];
      i += 2;
      continue;
    }
    if (ch === '"') {
      const rest = text.slice(i + 1).trimStart();
      if (rest.startsWith("}") || rest.startsWith(",")) break;
      content += '"';
      i += 1;
      continue;
    }
    content += ch;
    i += 1;
  }

  return content || null;
}

function extractParagraphs(text) {
  const re = /"body_paragraphs"\s*:\s*\[([\s\S]*?)\]/;
  const match = text.match(re);
  if (!match) return null;
  const items = [];
  const itemRe = /"((?:\\.|[^"\\])*)"/g;
  let m;
  while ((m = itemRe.exec(match[1])) !== null) {
    try {
      items.push(JSON.parse(`"${m[1]}"`));
    } catch {
      items.push(m[1].replace(/\\n/g, "\n").replace(/\\"/g, '"'));
    }
  }
  return items.length ? items : null;
}

export function parseModelJson(raw) {
  if (raw == null) {
    throw new Error("Empty model response");
  }

  const text = stripCodeFences(String(raw)).trim();
  if (!text) {
    throw new Error("Empty model response");
  }
  let parsed = tryParse(text);
  if (parsed) return parsed;

  const objectText = extractJsonObject(text);
  if (objectText) {
    parsed = tryParse(objectText);
    if (parsed) return parsed;

    parsed = tryParse(repairJsonStringLiterals(objectText));
    if (parsed) return parsed;
  }

  const subject = extractFieldString(text, "subject");
  const bodyHtml = extractFieldString(text, "body_html");
  const paragraphs = extractParagraphs(text);

  if (subject || bodyHtml || paragraphs) {
    return {
      subject: subject || "",
      body_html: bodyHtml || null,
      body_paragraphs: paragraphs || null,
    };
  }

  const extractionFields = [
    "employee_name",
    "employee_email",
    "email_purpose",
    "details",
  ];
  const extracted = {};
  for (const field of extractionFields) {
    const value = extractFieldString(text, field);
    if (value) extracted[field] = value;
  }
  if (Object.keys(extracted).length > 0) {
    return extracted;
  }

  throw new Error("Could not parse model JSON response");
}

export function paragraphsToHtml(paragraphs) {
  if (!Array.isArray(paragraphs) || paragraphs.length === 0) {
    return "";
  }
  return paragraphs
    .map((p) => String(p).trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join("\n");
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function normalizeEmailDraft(rawContent) {
  const parsed = parseModelJson(rawContent);
  const subject = String(parsed.subject || "").trim();
  let body_html = String(parsed.body_html || "").trim();

  if (!body_html && Array.isArray(parsed.body_paragraphs)) {
    body_html = paragraphsToHtml(parsed.body_paragraphs);
  }

  if (!subject || !body_html) {
    throw new Error("Model response missing subject or body");
  }

  return { subject, body_html };
}
