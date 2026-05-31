// app/api/emails/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Email from "@/models/Email";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";

// Get emails for a specific employee/contact
export async function GET(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const email = searchParams.get("email");

    let query = { userId };

    // If employeeId is provided, filter by employeeId
    if (employeeId) {
      query.employeeId = employeeId;
    } else if (email) {
      // If email is provided, find the employee first
      const employee = await Employee.findOne({ userId, email });
      if (employee) {
        query.employeeId = employee._id;
      } else {
        // If employee not found, filter by email directly
        query.to = email;
      }
    }

    const emails = await Email.find(query)
      .populate("employeeId", "name email")
      .sort({ sentAt: -1 })
      .lean();

    // Format the response
    const formattedEmails = emails.map((email) => ({
      id: email._id.toString(),
      to: email.to,
      toName: email.toName,
      recipients: email.recipients || [],
      cc: email.cc || [],
      subject: email.subject,
      body_html: email.body_html,
      from: email.from,
      fromName: email.fromName,
      sentAt: email.sentAt,
      employee: email.employeeId
        ? {
            id: email.employeeId._id.toString(),
            name: email.employeeId.name,
            email: email.employeeId.email,
          }
        : null,
    }));

    return NextResponse.json({ emails: formattedEmails });
  } catch (err) {
    console.error("Get emails error:", err);
    return NextResponse.json(
      { error: "Failed to fetch emails" },
      { status: 500 }
    );
  }
}

