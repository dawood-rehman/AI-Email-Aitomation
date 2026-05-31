import Link from "next/link";
import EmailSettingsForm from "@/components/EmailSettingsForm";
import { FiArrowLeft, FiMail } from "react-icons/fi";

export default function EmailSettingsPage() {
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
              <FiMail className="text-white text-2xl" />
            </div>
            <div>
              <h1 className="text-3xl font-bold gradient-text">
                Email & SMTP Settings
              </h1>
              <p className="text-sm text-stone-600 mt-1">
                Configure the SMTP credentials that should be used whenever you send
                mails. The application will always prefer these settings over any
                shared defaults, so make sure the host, credentials, and from address
                are valid.
              </p>
            </div>
          </div>
        </div>

        <EmailSettingsForm />
      </div>
    </main>
  );
}
