"use client";

import { useEffect, useState } from "react";
import { FiEye, FiEyeOff, FiSave, FiShield } from "react-icons/fi";

const defaultFormState = {
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  fromName: "",
  fromEmail: "",
  secure: false,
};

export default function EmailSettingsForm() {
  const [form, setForm] = useState(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [userEmail, setUserEmail] = useState("");
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("Unable to load user profile");
        const data = await res.json();
        const existing = data?.user?.emailSettings || {};

        setUserEmail(data?.user?.email || "");
        setForm({
          smtpHost: existing.smtpHost || "",
          smtpPort:
            existing.smtpPort !== undefined
              ? String(existing.smtpPort)
              : defaultFormState.smtpPort,
          smtpUser: existing.smtpUser || "",
          smtpPass: existing.smtpPass || "",
          fromName: existing.fromName || data?.user?.name || "",
          fromEmail: existing.fromEmail || data?.user?.email || "",
          secure: Boolean(existing.secure),
        });
      } catch (err) {
        console.error("Failed to load profile:", err);
        setMessage(err.message || "Could not load user profile");
        setMessageType("error");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageType("info");

    const payload = {
      ...form,
      smtpPort: Number(form.smtpPort) || 587,
      secure: Boolean(form.secure),
    };

    try {
      const res = await fetch("/api/user/email-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save email settings");
      }

      setMessage("Email settings saved successfully.");
      setMessageType("success");
    } catch (err) {
      console.error("Save email settings error:", err);
      setMessage(err.message || "Failed to save email settings");
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  };

  const infoLabelStyle = "block text-sm font-semibold text-stone-800 mb-1";
  const inputStyle = "input-field";

  return (
    <section className="card mx-auto max-w-3xl settings-card-padding">
      <p className="text-sm text-stone-600 leading-relaxed">
        Configure SMTP credentials so the app can send emails from your account (
        {userEmail || "your account"}). Use a provider like Gmail/SendGrid, then
        paste the host, username, password, and the name/email that should appear
        in the 'from' field.
      </p>

      {message && (
        <div
          className={`mt-4 rounded border px-4 py-2 text-sm ${
            messageType === "error"
              ? "border-red-300 bg-red-50 text-red-700"
              : "border-green-300 bg-green-50 text-green-700"
          }`}
        >
          {message}
        </div>
      )}

      <form onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={infoLabelStyle} htmlFor="smtpHost">
            SMTP Host
          </label>
          <input
            id="smtpHost"
            name="smtpHost"
            required
            placeholder="smtp.gmail.com"
            value={form.smtpHost}
            onChange={handleChange}
            disabled={loading}
            autoComplete="url"
            className={inputStyle}
          />
        </div>

        <div>
          <label className={infoLabelStyle} htmlFor="smtpPort">
            SMTP Port
          </label>
          <input
            id="smtpPort"
            name="smtpPort"
            type="number"
            min="1"
            max="65535"
            required
            value={form.smtpPort}
            onChange={handleChange}
            disabled={loading}
            inputMode="numeric"
            className={inputStyle}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={infoLabelStyle} htmlFor="smtpUser">
            SMTP Username
          </label>
          <input
            id="smtpUser"
            name="smtpUser"
            required
            placeholder="your@email.com"
            value={form.smtpUser}
            onChange={handleChange}
            disabled={loading}
            autoComplete="username"
            className={inputStyle}
          />
        </div>

        <div className="sm:col-span-2">
          <label className={infoLabelStyle} htmlFor="smtpPass">
            SMTP Password (app password if required)
          </label>
          <div className="relative">
            <input
              id="smtpPass"
              name="smtpPass"
              type={showSmtpPassword ? "text" : "password"}
              required
              value={form.smtpPass}
              onChange={handleChange}
              disabled={loading}
              autoComplete="off"
              className={`${inputStyle} input-field-with-action`}
            />
            <button
              type="button"
              onClick={() => setShowSmtpPassword(!showSmtpPassword)}
              className="password-toggle"
              aria-label={showSmtpPassword ? "Hide SMTP password" : "Show SMTP password"}
            >
              {showSmtpPassword ? <FiEyeOff className="w-5 h-5" /> : <FiEye className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div>
          <label className={infoLabelStyle} htmlFor="fromName">
            From name
          </label>
          <input
            id="fromName"
            name="fromName"
            placeholder="AI Email Assistant"
            value={form.fromName}
            onChange={handleChange}
            disabled={loading}
            autoComplete="name"
            className={inputStyle}
          />
        </div>

        <div>
          <label className={infoLabelStyle} htmlFor="fromEmail">
            From email
          </label>
          <input
            id="fromEmail"
            name="fromEmail"
            type="email"
            required
            value={form.fromEmail}
            onChange={handleChange}
            disabled={loading}
            autoComplete="email"
            className={inputStyle}
          />
        </div>


        <label className="sm:col-span-2 flex items-start gap-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-3 cursor-pointer">
          <input
            name="secure"
            type="checkbox"
            checked={form.secure}
            onChange={handleChange}
            disabled={loading}
            className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
          />
          <span>
            <span className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <FiShield className="text-emerald-600" />
              Use a secure TLS connection
            </span>
            <span className="mt-1 block text-xs leading-relaxed text-stone-500">
              Enable this when your SMTP provider requires an encrypted connection, commonly with port 465.
            </span>
          </span>
        </label>

        <div className="sm:col-span-2">
          <button
            type="submit"
            disabled={loading || saving}
            className="btn-primary w-full flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <FiSave />
            {saving ? "Saving..." : "Save SMTP settings"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs leading-relaxed text-gray-500">
        Gmail users: create an{" "}
        <a
          href="https://support.google.com/accounts/answer/185833"
          target="_blank"
          rel="noreferrer"
          className="font-medium text-emerald-700 underline underline-offset-2"
        >
          app password
        </a>{" "}
        and use it here. For other providers, double-check that the host, port,
        and secure settings match their documentation.
      </p>
    </section>
  );
}

