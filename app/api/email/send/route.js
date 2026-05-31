import { NextResponse } from "next/server";
import { getFromAddress, getTransporter, getMergedEmailSettings } from "@/lib/email";
import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const user = await User.findById(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { to, subject, body_html, cc } = await req.json();

    if (!to || !subject || !body_html) {
      return NextResponse.json(
        { error: "Missing required fields: to, subject, or body_html" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      return NextResponse.json(
        { error: "Invalid email address format" },
        { status: 400 }
      );
    }

    let ccList = [];
    if (Array.isArray(cc)) {
      ccList = cc.filter((email) => typeof email === "string" && email.trim());
    } else if (typeof cc === "string" && cc.trim()) {
      ccList = cc
        .split(",")
        .map((email) => email.trim())
        .filter(Boolean);
    }

    for (const email of ccList) {
      if (!emailRegex.test(email)) {
        return NextResponse.json(
          { error: `Invalid CC email address format: ${email}` },
          { status: 400 }
        );
      }
    }

    const mergedSettings = getMergedEmailSettings(user.emailSettings);
    const transporter = getTransporter(mergedSettings);
    const from = getFromAddress(mergedSettings, user.email);

    const missingFields = [];
    if (!mergedSettings.smtpHost) missingFields.push("SMTP Host");
    if (!mergedSettings.smtpUser) missingFields.push("SMTP Username");
    if (!mergedSettings.smtpPass) missingFields.push("SMTP Password");
    if (!from.email) missingFields.push("From Email");

    if (missingFields.length) {
      return NextResponse.json(
        {
          error:
            "SMTP configuration is incomplete. Open Email & SMTP settings and save the required fields before sending.",
          needsEmailConfig: true,
          setupPath: "/email-settings",
          missingFields,
        },
        { status: 400 }
      );
    }

    await transporter.sendMail({
      from: `"${from.name}" <${from.email}>`,
      to,
      cc: ccList.length ? ccList : undefined,
      subject,
      html: body_html,
    });

    return NextResponse.json({ success: true, message: "Email sent successfully" });
  } catch (err) {
    console.error("Send error:", err);

    let errorMessage = "Failed to send email";

    if (err.code === "EAUTH") {
      errorMessage = "Email authentication failed. Check SMTP credentials & App Password.";
    } else if (err.code === "ECONNECTION") {
      errorMessage = "Cannot connect to email server. Check SMTP_HOST and SMTP_PORT.";
    } else if (err.message) {
      errorMessage = err.message;
    }

    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
