import { createChatCompletion, getCompletionText } from "@/lib/openai";
import {
  normalizeEmailDraft,
  paragraphsToHtml,
  parseModelJson,
} from "@/lib/parseModelJson";

const COMPANY_NAME = () => process.env.COMPANY_NAME || "Our Company";

export function getGreetingLine(personalizeName, recipientName) {
  if (personalizeName && recipientName?.trim()) {
    return `Dear ${recipientName.trim()},`;
  }
  return "Hello,";
}

/** When the user already picked contacts, skip a fragile JSON extraction call. */
export function buildParsedFromSelection(contact, command) {
  return {
    employee_name: contact.name,
    employee_email: contact.email,
    email_purpose: command,
    details: command,
  };
}

const EXTRACTION_FIELDS = [
  "employee_name",
  "employee_email",
  "email_purpose",
  "details",
];

function extractFieldLoose(text, field) {
  const patterns = [
    new RegExp(`"${field}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "is"),
    new RegExp(`'${field}'\\s*:\\s*'((?:\\\\.|[^'\\\\])*)'`, "is"),
    new RegExp(`${field}\\s*[:=]\\s*"?([^"\\n,}]+)"?`, "i"),
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (!match?.[1]) continue;
    return match[1]
      .trim()
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/^['"]|['"]$/g, "");
  }
  return null;
}

/** Parse HR extraction JSON; never throws — uses command as fallback. */
export function parseCommandExtraction(raw, defaults = {}) {
  const base = { ...defaults };

  if (!raw?.trim()) {
    return {
      ...base,
      email_purpose: base.email_purpose || defaults.details || "",
      details: base.details || defaults.email_purpose || "",
    };
  }

  try {
    return { ...base, ...parseModelJson(raw) };
  } catch {
    const merged = { ...base };
    for (const field of EXTRACTION_FIELDS) {
      const value = extractFieldLoose(raw, field);
      if (value) merged[field] = value;
    }

    if (merged.employee_name || merged.email_purpose || merged.details) {
      return merged;
    }

    return {
      ...base,
      email_purpose: base.email_purpose || raw.trim().slice(0, 2000),
      details: base.details || raw.trim().slice(0, 2000),
    };
  }
}

export async function extractCommandMetadata(command, contact = null) {
  if (contact?.name) {
    return buildParsedFromSelection(contact, command);
  }

  const completion = await createChatCompletion({
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "Extract fields from the user command. Reply with ONLY valid JSON, no markdown. " +
          'Keys: employee_name (string), employee_email (optional string), email_purpose (string), details (string).',
      },
      { role: "user", content: command },
    ],
  });

  return parseCommandExtraction(getCompletionText(completion), {
    email_purpose: command,
    details: command,
  });
}

/** Plain-text format works reliably with reasoning models (gpt-oss). */
export function parsePlainEmailDraft(text) {
  if (!text?.trim()) {
    throw new Error("Empty model response");
  }

  let trimmed = text.trim();
  const subjectAnchor = trimmed.search(/\bSUBJECT\s*:/i);
  if (subjectAnchor > 0) {
    trimmed = trimmed.slice(subjectAnchor);
  }

  const subjectMatch = trimmed.match(/^SUBJECT\s*:\s*(.+?)(?:\r?\n|$)/im);
  const bodyMatch = trimmed.match(/^BODY\s*:\s*([\s\S]*)$/im);

  if (!subjectMatch) {
    throw new Error("Could not parse plain email format (missing SUBJECT)");
  }

  const subject = subjectMatch[1].trim();
  let paragraphs = [];

  if (bodyMatch) {
    const bodyText = bodyMatch[1].trim();
    if (bodyText.includes("\n---\n") || bodyText.includes("\r\n---\r\n")) {
      paragraphs = bodyText
        .split(/\r?\n---\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    } else {
      paragraphs = bodyText
        .split(/\r?\n\r?\n/)
        .map((p) => p.trim())
        .filter(Boolean);
    }
  }

  if (paragraphs.length === 0) {
    const afterSubject = trimmed
      .replace(/^SUBJECT\s*:\s*.+?(?:\r?\n|$)/im, "")
      .replace(/^BODY\s*:\s*/im, "")
      .trim();
    if (afterSubject) {
      paragraphs = [afterSubject];
    }
  }

  if (!subject || paragraphs.length === 0) {
    throw new Error("Model response missing subject or body");
  }

  return {
    subject,
    body_html: paragraphsToHtml(paragraphs),
  };
}

function buildUserPrompt({
  command,
  employee,
  parsed,
  personalizeName,
  recipientCount = 1,
}) {
  const greeting = getGreetingLine(personalizeName, employee?.name);

  if (!personalizeName) {
    return `Generate a professional workplace email for MULTIPLE recipients (${recipientCount} people).

Command: "${command}"

Purpose: ${parsed.email_purpose || "HR communication"}
Details: ${parsed.details || command}

Rules:
- Do NOT mention or guess any individual person's name in the subject or body
- Opening greeting must be exactly: ${greeting}
- Write in a neutral tone suitable for a group
- Company: ${COMPANY_NAME()}`;
  }

  return `Generate a professional workplace email.

Command: "${command}"

Recipient:
- Name: ${employee.name}
- Email: ${employee.email}
- Role: ${employee.role || "N/A"}
- Department: ${employee.department || "N/A"}

Purpose: ${parsed.email_purpose || "HR communication"}
Details: ${parsed.details || command}

Opening greeting must be exactly: ${greeting}
Personalize for ${employee.name}. Company: ${COMPANY_NAME()}.`;
}

const JSON_SYSTEM = (greetingLine, personalizeName) =>
  `You write professional HR emails. Reply with ONLY valid JSON (no markdown).
Keys: "subject" (string), "body_paragraphs" (array of plain-text strings).
Rules:
- No HTML in paragraphs
- No unescaped double quotes inside strings
- First paragraph must begin with exactly: ${greetingLine}
${personalizeName ? "" : "- Do NOT use any person's name anywhere in the email\n"}
- Last paragraph is a sign-off with company name ${COMPANY_NAME()}
- 3-6 short paragraphs total`;

const PLAIN_SYSTEM = (greetingLine, personalizeName) =>
  `You write professional HR emails. Reply with ONLY this exact plain-text format (no JSON, no code fences):

SUBJECT: <one line>
BODY:
<paragraph 1 - must begin with exactly: ${greetingLine}>
---
<middle paragraphs>
---
<sign-off with ${COMPANY_NAME()}>
${personalizeName ? "" : "\nDo NOT use any individual person's name in the email."}`;

export async function generateEmailDraft({
  command,
  employee,
  parsed,
  personalizeName = true,
  recipientCount = 1,
}) {
  const greetingLine = getGreetingLine(personalizeName, employee?.name);
  const userContent = buildUserPrompt({
    command,
    employee,
    parsed,
    personalizeName,
    recipientCount,
  });
  const errors = [];

  // 1) Plain text first for gpt-oss / reasoning models (most reliable)
  try {
    const plainCompletion = await createChatCompletion({
      messages: [
        {
          role: "system",
          content: PLAIN_SYSTEM(greetingLine, personalizeName),
        },
        { role: "user", content: userContent },
      ],
    });
    return parsePlainEmailDraft(getCompletionText(plainCompletion));
  } catch (err) {
    errors.push(`plain: ${err.message}`);
  }

  // 2) JSON mode
  try {
    const jsonCompletion = await createChatCompletion({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: JSON_SYSTEM(greetingLine, personalizeName),
        },
        { role: "user", content: userContent },
      ],
    });
    return normalizeEmailDraft(getCompletionText(jsonCompletion));
  } catch (err) {
    errors.push(`json: ${err.message}`);
  }

  // 3) Unstructured JSON-ish retry
  try {
    const looseCompletion = await createChatCompletion({
      messages: [
        {
          role: "system",
          content:
            "Write the email. Output JSON with keys subject and body_paragraphs (string array). No markdown.",
        },
        { role: "user", content: userContent },
      ],
    });
    return normalizeEmailDraft(getCompletionText(looseCompletion));
  } catch (err) {
    errors.push(`loose: ${err.message}`);
  }

  throw new Error(
    `Could not generate email draft (${errors.join("; ")})`
  );
}
