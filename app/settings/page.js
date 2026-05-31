"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import EmailSettingsForm from "@/components/EmailSettingsForm";
import { FiArrowLeft, FiUser, FiMail, FiLock, FiSettings, FiSave } from "react-icons/fi";
import { HiOutlineSparkles } from "react-icons/hi";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form state
  const [profileForm, setProfileForm] = useState({ name: "" });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageType, setProfileMessageType] = useState("");

  // Email form state
  const [emailForm, setEmailForm] = useState({ email: "", password: "" });
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailMessage, setEmailMessage] = useState("");
  const [emailMessageType, setEmailMessageType] = useState("");
  const [showEmailPassword, setShowEmailPassword] = useState(false);

  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState("");
  const [passwordMessageType, setPasswordMessageType] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const loadUser = async () => {
      try {
        const res = await fetch("/api/auth/me");
        if (!res.ok) throw new Error("Unable to load user profile");
        const data = await res.json();
        setUser(data.user);
        setProfileForm({ name: data.user.name || "" });
        setEmailForm({ email: data.user.email || "", password: "" });
      } catch (err) {
        console.error("Failed to load user:", err);
      } finally {
        setLoading(false);
      }
    };
    loadUser();
  }, []);

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setProfileSaving(true);
    setProfileMessage("");
    setProfileMessageType("");

    try {
      const res = await fetch("/api/user/update-profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profileForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      setUser(data.user);
      setProfileMessage("Profile updated successfully!");
      setProfileMessageType("success");
    } catch (err) {
      setProfileMessage(err.message || "Failed to update profile");
      setProfileMessageType("error");
    } finally {
      setProfileSaving(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    setEmailSaving(true);
    setEmailMessage("");
    setEmailMessageType("");

    try {
      const res = await fetch("/api/user/update-email", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(emailForm),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update email");
      }

      setUser(data.user);
      setEmailForm({ email: data.user.email, password: "" });
      setEmailMessage("Email updated successfully!");
      setEmailMessageType("success");
    } catch (err) {
      setEmailMessage(err.message || "Failed to update email");
      setEmailMessageType("error");
    } finally {
      setEmailSaving(false);
    }
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordSaving(true);
    setPasswordMessage("");
    setPasswordMessageType("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage("New passwords do not match");
      setPasswordMessageType("error");
      setPasswordSaving(false);
      return;
    }

    try {
      const res = await fetch("/api/user/update-password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password");
      }

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setPasswordMessage("Password updated successfully!");
      setPasswordMessageType("success");
    } catch (err) {
      setPasswordMessage(err.message || "Failed to update password");
      setPasswordMessageType("error");
    } finally {
      setPasswordSaving(false);
    }
  };

  const inputStyle = "input-field";
  const labelStyle = "block text-sm font-semibold text-stone-800 mb-1";
  const buttonStyle = "btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed";

  const tabs = [
    { id: "profile", label: "Profile" },
    { id: "email", label: "Email" },
    { id: "password", label: "Password" },
    { id: "smtp", label: "SMTP Settings" },
  ];

  if (loading) {
    return (
      <main className="page-bg min-h-screen px-4 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="text-center text-stone-600">
            <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
            Loading...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-bg min-h-screen px-4 py-10">
      <div className="mx-auto max-w-4xl space-y-6">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition-colors group"
          >
            <FiArrowLeft className="group-hover:-translate-x-1 transition-transform" />
            <span>Back to dashboard</span>
          </Link>
          <div className="flex items-center gap-3">
            <div className="icon-box p-3">
              <FiSettings className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                Settings
              </h1>
              <p className="text-sm text-stone-600 mt-1">
                Manage your account settings, email, password, and SMTP configuration.
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-stone-200 bg-white rounded-t-xl shadow-sm">
          <nav className="-mb-px flex space-x-1 px-2">
            {tabs.map((tab) => {
              const icons = {
                profile: FiUser,
                email: FiMail,
                password: FiLock,
                smtp: FiSettings,
              };
              const Icon = icons[tab.id] || FiUser;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`whitespace-nowrap border-b-2 px-4 py-4 text-sm font-medium transition-all flex items-center gap-2 ${
                    activeTab === tab.id
                      ? "tab-active"
                      : "border-transparent text-stone-500 hover:border-stone-300 hover:text-stone-700 hover:bg-stone-50"
                  }`}
                >
                  <Icon className="text-base" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === "profile" && (
          <section className="card rounded-t-none rounded-b-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-emerald-100">
                <FiUser className="text-emerald-600 text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Profile Information
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Update your name and profile information.
            </p>

            {profileMessage && (
              <div
                className={`mb-4 rounded border px-4 py-2 text-sm ${
                  profileMessageType === "error"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-green-300 bg-green-50 text-green-700"
                }`}
              >
                {profileMessage}
              </div>
            )}

            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className={labelStyle} htmlFor="name">
                  Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  required
                  value={profileForm.name}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, name: e.target.value })
                  }
                  disabled={profileSaving}
                  className={inputStyle}
                />
              </div>

              <div>
                <button
                  type="submit"
                  disabled={profileSaving}
                  className={`${buttonStyle} flex items-center justify-center gap-2`}
                >
                  {profileSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <FiSave className="text-base" />
                      <span>Save Profile</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Email Tab */}
        {activeTab === "email" && (
          <section className="card rounded-t-none rounded-b-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-violet-100">
                <FiMail className="text-violet-600 text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Change Email Address
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Update your email address. You'll need to enter your current
              password to confirm the change.
            </p>

            {emailMessage && (
              <div
                className={`mb-4 rounded border px-4 py-2 text-sm ${
                  emailMessageType === "error"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-green-300 bg-green-50 text-green-700"
                }`}
              >
                {emailMessage}
              </div>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              <div>
                <label className={labelStyle} htmlFor="email">
                  New Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={emailForm.email}
                  onChange={(e) =>
                    setEmailForm({ ...emailForm, email: e.target.value })
                  }
                  disabled={emailSaving}
                  className={inputStyle}
                />
              </div>

              <div>
                <label className={labelStyle} htmlFor="emailPassword">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="emailPassword"
                    name="password"
                    type={showEmailPassword ? "text" : "password"}
                    required
                    value={emailForm.password}
                    onChange={(e) =>
                      setEmailForm({ ...emailForm, password: e.target.value })
                    }
                    disabled={emailSaving}
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowEmailPassword(!showEmailPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showEmailPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={emailSaving}
                  className={`${buttonStyle} flex items-center justify-center gap-2`}
                >
                  {emailSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FiSave className="text-base" />
                      <span>Update Email</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* Password Tab */}
        {activeTab === "password" && (
          <section className="card rounded-t-none rounded-b-xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-red-100">
                <FiLock className="text-red-600 text-xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                Change Password
              </h2>
            </div>
            <p className="mb-6 text-sm text-gray-600">
              Update your password. Make sure to use a strong password.
            </p>

            {passwordMessage && (
              <div
                className={`mb-4 rounded border px-4 py-2 text-sm ${
                  passwordMessageType === "error"
                    ? "border-red-300 bg-red-50 text-red-700"
                    : "border-green-300 bg-green-50 text-green-700"
                }`}
              >
                {passwordMessage}
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className={labelStyle} htmlFor="currentPassword">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    id="currentPassword"
                    name="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    required
                    value={passwordForm.currentPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        currentPassword: e.target.value,
                      })
                    }
                    disabled={passwordSaving}
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowCurrentPassword(!showCurrentPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showCurrentPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelStyle} htmlFor="newPassword">
                  New Password
                </label>
                <div className="relative">
                  <input
                    id="newPassword"
                    name="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordForm.newPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        newPassword: e.target.value,
                      })
                    }
                    disabled={passwordSaving}
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showNewPassword ? "Hide" : "Show"}
                  </button>
                </div>
                <p className="mt-1 text-xs text-gray-500">
                  Must be at least 6 characters long
                </p>
              </div>

              <div>
                <label className={labelStyle} htmlFor="confirmPassword">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={passwordForm.confirmPassword}
                    onChange={(e) =>
                      setPasswordForm({
                        ...passwordForm,
                        confirmPassword: e.target.value,
                      })
                    }
                    disabled={passwordSaving}
                    className={inputStyle}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowConfirmPassword(!showConfirmPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-600 hover:text-gray-800"
                  >
                    {showConfirmPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className={`${buttonStyle} flex items-center justify-center gap-2`}
                >
                  {passwordSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      <span>Updating...</span>
                    </>
                  ) : (
                    <>
                      <FiSave className="text-base" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </section>
        )}

        {/* SMTP Settings Tab */}
        {activeTab === "smtp" && (
          <section>
            <EmailSettingsForm />
          </section>
        )}
      </div>
    </main>
  );
}

