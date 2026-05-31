// app/api/auth/me/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import User from "@/models/User";
import { getUserIdFromRequest } from "@/lib/auth";
import { getMergedEmailSettings } from "@/lib/email";

export async function GET(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const user = await User.findById(userId).select("-password -resetPasswordToken -resetPasswordExpires");
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const mergedEmailSettings = getMergedEmailSettings(user.emailSettings);
    const storedPass =
      typeof user.emailSettings?.smtpPass === "string"
        ? user.emailSettings.smtpPass.trim()
        : "";

    return NextResponse.json({
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        emailSettings: {
          ...mergedEmailSettings,
          smtpPass: storedPass,
        },
      },
    });
  } catch (err) {
    console.error("Get user error:", err);
    return NextResponse.json(
      { error: "Failed to get user" },
      { status: 500 }
    );
  }
}

