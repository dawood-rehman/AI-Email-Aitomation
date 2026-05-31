import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";

export async function PATCH(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const emailSettings = {
      smtpHost: (body.smtpHost || "").trim(),
      smtpPort: Number(body.smtpPort) || 587,
      smtpUser: (body.smtpUser || "").trim(),
      smtpPass: (body.smtpPass || "").trim(),
      fromName: (body.fromName || "").trim(),
      fromEmail: (body.fromEmail || "").trim(),
      secure: Boolean(body.secure),
    };

    if (!emailSettings.smtpHost) {
      return NextResponse.json(
        { error: "smtpHost is required" },
        { status: 400 }
      );
    }

    if (!emailSettings.smtpUser || !emailSettings.smtpPass) {
      return NextResponse.json(
        { error: "smtpUser and smtpPass are required" },
        { status: 400 }
      );
    }

    if (!emailSettings.fromEmail) {
      return NextResponse.json(
        { error: "fromEmail is required" },
        { status: 400 }
      );
    }

    await connectToDB();
    const user = await User.findByIdAndUpdate(
      userId,
      { emailSettings },
      { new: true }
    );

    if (!user) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      emailSettings: user.emailSettings,
    });
  } catch (err) {
    console.error("Update email settings error:", err);
    return NextResponse.json(
      { error: "Failed to update email settings" },
      { status: 500 }
    );
  }
}

