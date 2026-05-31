"use client";

import { useEffect, useState } from "react";

const defaultFormState = {
  smtpHost: "",
  smtpPort: "587",
  smtpUser: "",
  smtpPass: "",
  fromName: "",
  fromEmail: "",
};

export default function EmailSettingsForm() {
  const [form, setForm] = useState(defaultFormState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [userEmail, setUserEmail] = useState("");

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
    <section className="card mx-auto max-w-3xl p-6">
      <p className="text-sm text-stone-600">
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

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
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
            className={inputStyle}
          />
        </div>

        <div>
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
            className={inputStyle}
          />
        </div>

        <div>
          <label className={infoLabelStyle} htmlFor="smtpPass">
            SMTP Password (app password if required)
          </label>
          <input
            id="smtpPass"
            name="smtpPass"
            type="password"
            required
            value={form.smtpPass}
            onChange={handleChange}
            disabled={loading}
            className={inputStyle}
          />
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
            className={inputStyle}
          />
        </div>


        <div>
          <button
            type="submit"
            disabled={loading || saving}
            className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? "Saving…" : "Save SMTP settings"}
          </button>
        </div>
      </form>

      <p className="mt-4 text-xs text-gray-500">
        Gmail users: create an app password (https://support.google.com/accounts/answer/185833) and use it here. For other providers, double-check that the host,
        port, and secure settings match what they recommend.
      </p>
    </section>
  );
}

