// app/api/email/draft/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";
import {
  extractCommandMetadata,
  generateEmailDraft,
} from "@/lib/emailDraftAi";

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function POST(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { command, selectedContacts } = await req.json();
    if (!command) {
      return NextResponse.json(
        { error: "Command is required" },
        { status: 400 }
      );
    }

    await connectToDB();

    let employee = null;
    let parsed = null;
    const contactCount = selectedContacts?.length || 0;
    const isMultiRecipient = contactCount > 1;
    const personalizeName = contactCount === 1;
    const firstContact = contactCount > 0 ? selectedContacts[0] : null;

    if (firstContact) {
      if (isMultiRecipient) {
        employee = {
          _id: null,
          name: null,
          email: null,
          role: null,
          department: null,
        };
        parsed = await extractCommandMetadata(command);
      } else {
        employee = await Employee.findOne({
          userId,
          $or: [
            { email: firstContact.email },
            {
              name: {
                $regex: new RegExp(
                  `^${escapeRegex(firstContact.name)}$`,
                  "i"
                ),
              },
            },
          ],
        });

        if (!employee) {
          employee = {
            _id: firstContact._id || null,
            name: firstContact.name,
            email: firstContact.email,
            role: firstContact.role || null,
            department: firstContact.department || null,
          };
        }

        parsed = await extractCommandMetadata(command, firstContact);
      }
    } else {
      parsed = await extractCommandMetadata(command);
      const employeeName = parsed.employee_name?.trim();

      if (!employeeName || employeeName === "Not provided") {
        return NextResponse.json(
          {
            error:
              "Could not detect employee name from command. Please mention the employee's name or select contacts from the list.",
          },
          { status: 400 }
        );
      }

      const normalizedEmployeeName = employeeName.replace(/\s+/g, " ").trim();
      const nameParts = normalizedEmployeeName.split(" ").filter(Boolean);
      const firstName = nameParts[0];

      const query = {
        $or: [
          {
            name: {
              $regex: new RegExp(
                `^${escapeRegex(normalizedEmployeeName)}$`,
                "i"
              ),
            },
          },
          {
            name: {
              $regex: new RegExp(escapeRegex(normalizedEmployeeName), "i"),
            },
          },
        ],
      };

      if (firstName && firstName.length >= 2) {
        query.$or.push({
          name: {
            $regex: new RegExp(`^${escapeRegex(firstName)}(\\s|$)`, "i"),
          },
        });
      }

      if (parsed.employee_email) {
        query.$or.push({
          email: {
            $regex: new RegExp(
              `^${escapeRegex(parsed.employee_email.trim())}$`,
              "i"
            ),
          },
        });
      }

      employee = await Employee.findOne({ ...query, userId });

      if (!employee) {
        return NextResponse.json(
          {
            error: `No employee found with name '${employeeName}'. Please check the name or select contacts from the list.`,
          },
          { status: 404 }
        );
      }
    }

    const emailContent = await generateEmailDraft({
      command,
      employee,
      parsed,
      personalizeName,
      recipientCount: contactCount || 1,
    });

    return NextResponse.json({
      isMultiRecipient,
      employee: personalizeName
        ? {
            id: employee._id ? employee._id.toString() : employee._id,
            name: employee.name,
            email: employee.email,
            role: employee.role || null,
            department: employee.department || null,
          }
        : null,
      subject: emailContent.subject,
      body_html: emailContent.body_html,
      command,
    });
  } catch (err) {
    console.error("Draft error:", err);
    const errText = err?.message || "";
    const message = errText.includes("missing subject or body")
      ? "AI returned an incomplete draft. Please try again."
      : errText.includes("Empty model response") ||
          errText.includes("empty responses") ||
          errText.includes("no content")
        ? "AI returned an empty response. Check OPENROUTER_API_KEY and try again."
        : errText.includes("parse") ||
            errText.includes("JSON") ||
            errText.includes("generate email draft")
          ? "AI could not format the draft. Please try again with a shorter command."
          : "Failed to generate email draft";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
