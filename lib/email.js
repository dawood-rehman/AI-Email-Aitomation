// lib/email.js
import nodemailer from "nodemailer";

const parsePortValue = (value) => {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0 && parsed <= 65535) {
    return parsed;
  }

  return undefined;
};

export function getDefaultEmailSettings() {
  return {
    smtpHost: process.env.SMTP_HOST || "",
    smtpPort: parsePortValue(process.env.SMTP_PORT) ?? 587,
    smtpUser: process.env.SMTP_USER || "",
    smtpPass: process.env.SMTP_PASS || "",
    fromName: process.env.FROM_NAME || "",
    fromEmail: process.env.FROM_EMAIL || "",
    secure: process.env.SMTP_SECURE === "true",
  };
}

export function getMergedEmailSettings(userEmailSettings = null) {
  const defaultSettings = getDefaultEmailSettings();
  if (!userEmailSettings) {
    return defaultSettings;
  }

  const trimString = (value) =>
    typeof value === "string" ? value.trim() : "";

  const parsedPort = parsePortValue(userEmailSettings.smtpPort);

  return {
    smtpHost:
      trimString(userEmailSettings.smtpHost) ||
      defaultSettings.smtpHost ||
      "",
    smtpPort: parsedPort ?? defaultSettings.smtpPort,
    smtpUser:
      trimString(userEmailSettings.smtpUser) || defaultSettings.smtpUser || "",
    smtpPass:
      trimString(userEmailSettings.smtpPass) || defaultSettings.smtpPass || "",
    fromName:
      trimString(userEmailSettings.fromName) || defaultSettings.fromName || "",
    fromEmail:
      trimString(userEmailSettings.fromEmail) ||
      defaultSettings.fromEmail ||
      "",
    secure:
      typeof userEmailSettings.secure === "boolean"
        ? userEmailSettings.secure
        : defaultSettings.secure,
  };
}

export function getTransporter(userEmailSettings = null) {
  const settings = getMergedEmailSettings(userEmailSettings);
  const auth =
    settings.smtpUser && settings.smtpPass
      ? { user: settings.smtpUser, pass: settings.smtpPass }
      : undefined;

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: settings.smtpPort,
    secure: settings.secure,
    auth,
  });
}

// Get from name and email from user settings or env
export function getFromAddress(userEmailSettings = null, fallbackEmail = "") {
  const settings = getMergedEmailSettings(userEmailSettings);
  const name = settings.fromName || process.env.FROM_NAME || "AI Email Assistant";
  const email =
    settings.fromEmail || process.env.FROM_EMAIL || fallbackEmail || "";

  return { name, email };
}
