// app/api/email/draft/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { createChatCompletion } from "@/lib/openai";
import { getUserIdFromRequest } from "@/lib/auth";

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

    // If selectedContacts are provided (bulk email), use the first contact as template
    if (selectedContacts && selectedContacts.length > 0) {
      // For bulk emails, use the first selected contact as the template
      const firstContact = selectedContacts[0];
      
      // Try to find the employee in DB
      employee = await Employee.findOne({ 
        userId, 
        $or: [
          { email: firstContact.email },
          { name: { $regex: new RegExp(`^${escapeRegex(firstContact.name)}$`, "i") } }
        ]
      });

      // If not found in DB, create a temporary employee object from the contact
      if (!employee) {
        employee = {
          _id: firstContact._id || null,
          name: firstContact.name,
          email: firstContact.email,
          role: firstContact.role || null,
          department: firstContact.department || null,
        };
      }

      // Extract purpose and details from command
      const extraction = await createChatCompletion({
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that extracts structured info from HR email commands. " +
              "When no specific employee name is mentioned, return 'Not provided' for employee_name. " +
              "Return JSON with fields: employee_name (string, can be 'Not provided'), employee_email (string, optional), email_purpose (string), details (string).",
          },
          {
            role: "user",
            content: command,
          },
        ],
      });

      parsed = JSON.parse(extraction.choices[0].message.content);
    } else {
      // Step 1: Extract employee name + purpose from command (single email)
      const extraction = await createChatCompletion({
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "You are an assistant that extracts structured info from HR email commands. " +
              "Return JSON with fields: employee_name (string), employee_email (string, optional), email_purpose (string), details (string).",
          },
          {
            role: "user",
            content: command,
          },
        ],
      });

      parsed = JSON.parse(extraction.choices[0].message.content);
      const employeeName = parsed.employee_name?.trim();

      if (!employeeName || employeeName === "Not provided") {
        return NextResponse.json(
          { error: "Could not detect employee name from command. Please mention the employee's name or select contacts from the list." },
          { status: 400 }
        );
      }

      const normalizedEmployeeName = employeeName.replace(/\s+/g, " ").trim();
      const nameParts = normalizedEmployeeName.split(" ").filter(Boolean);
      const firstName = nameParts[0];

      const query = {
        $or: [
          { name: { $regex: new RegExp(`^${escapeRegex(normalizedEmployeeName)}$`, "i") } },
          { name: { $regex: new RegExp(escapeRegex(normalizedEmployeeName), "i") } },
        ],
      };

      if (firstName && firstName.length >= 2) {
        query.$or.push({
          name: { $regex: new RegExp(`^${escapeRegex(firstName)}(\\s|$)`, "i") },
        });
      }

      if (parsed.employee_email) {
        query.$or.push({
          email: { $regex: new RegExp(`^${escapeRegex(parsed.employee_email.trim())}$`, "i") },
        });
      }

      // Step 2: find employee in DB with flexible matching (user-specific)
      employee = await Employee.findOne({ ...query, userId });

      if (!employee) {
        return NextResponse.json(
          { error: `No employee found with name '${employeeName}'. Please check the name or select contacts from the list.` },
          { status: 404 }
        );
      }
    }

    // Step 3: generate email content
    const generation = await createChatCompletion({
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: `You are a professional HR email writer for a company. 
Write a well-structured, professional, and courteous email from the company to the employee.
The email should be clear, concise, and appropriate for workplace communication.

Requirements:
- Respond ONLY in valid JSON format with keys: subject, body_html
- Subject should be clear and professional
- Body should be in HTML format with proper paragraph tags, line breaks, and formatting
- Use professional greeting (Dear ${employee.name},)
- Include a professional closing (Best regards, [Company Name], etc.)
- Make the email tone appropriate: formal but friendly, respectful, and clear
- Format important information clearly using HTML tags (e.g., <strong>, <p>, <br>)

Company name: ${process.env.COMPANY_NAME || "Our Company"}

Format the HTML body professionally with:
- Opening greeting
- Clear explanation of the matter
- Any relevant details
- Professional closing`,
        },
        {
          role: "user",
          content: `Generate an HR email based on the following:

Command: "${command}"

Employee Information:
- Name: ${employee.name}
- Email: ${employee.email}
- Role: ${employee.role || "N/A"}
- Department: ${employee.department || "N/A"}

Email Purpose: ${parsed.email_purpose || "HR communication"}
Details: ${parsed.details || command}

Generate a professional email that addresses the command and is personalized for ${employee.name}.`,
        },
      ],
    });

    const emailContent = JSON.parse(generation.choices[0].message.content);

    const responsePayload = {
      employee: {
        id: employee._id ? employee._id.toString() : employee._id,
        name: employee.name,
        email: employee.email,
        role: employee.role || null,
        department: employee.department || null,
      },
      subject: emailContent.subject,
      body_html: emailContent.body_html,
      command,
    };

    return NextResponse.json(responsePayload);
  } catch (err) {
    console.error("Draft error:", err);
    return NextResponse.json(
      { error: "Failed to generate email draft" },
      { status: 500 }
    );
  }
}
