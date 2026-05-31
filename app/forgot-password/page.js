"use client";

import { useState } from "react";
import Link from "next/link";
import { FiMail, FiArrowLeft } from "react-icons/fi";
import { HiOutlineSparkles as SparklesIcon } from "react-icons/hi";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess(false);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to send reset email");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-bg min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(5,150,105,0.12),_transparent_50%)]" aria-hidden="true"></div>
      <div className="max-w-md w-full relative z-10">
        <div className="auth-card p-8">
          <div className="text-center mb-8">
            <div className="icon-box w-14 h-14 mb-4 mx-auto">
              <SparklesIcon className="text-white text-2xl" />
            </div>
            <h1 className="text-3xl font-bold gradient-text mb-2">
              Forgot Password
            </h1>
            <p className="text-stone-600">
              Enter your email address and we&apos;ll send you a link to reset your password.
            </p>
          </div>

          {success ? (
            <div className="space-y-4">
              <div className="alert-success">
                If an account exists with that email, a password reset link has been sent. Please check your inbox.
              </div>
              <Link
                href="/login"
                className="block text-center text-emerald-600 hover:text-emerald-700 font-medium text-sm"
              >
                Back to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2 flex items-center gap-2">
                  <FiMail className="text-emerald-600" />
                  <span>Email Address</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input-field"
                  placeholder="you@example.com"
                />
              </div>

              {error && <div className="alert-error">{error}</div>}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Sending...
                  </>
                ) : (
                  "Send Reset Link"
                )}
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium"
            >
              <FiArrowLeft className="text-sm" />
              Back to Login
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
