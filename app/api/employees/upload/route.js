// app/api/employees/upload/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";
import * as XLSX from "xlsx";

export async function POST(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();

    const formData = await req.formData();
    const file = formData.get("file");

    if (!file) {
      return NextResponse.json(
        { error: "No file uploaded" },
        { status: 400 }
      );
    }

    // Read file as buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Parse Excel file
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (data.length < 2) {
      return NextResponse.json(
        { error: "Excel file must have at least a header row and one data row" },
        { status: 400 }
      );
    }

    // Get headers (first row)
    const headers = data[0].map((h) => String(h || "").toLowerCase().trim());

    // Find column indices
    const nameIndex = headers.findIndex(
      (h) => h.includes("name") || h.includes("full name")
    );
    const emailIndex = headers.findIndex(
      (h) => h.includes("email") || h.includes("e-mail")
    );

    if (nameIndex === -1 || emailIndex === -1) {
      return NextResponse.json(
        { error: "Excel file must contain 'Name' and 'Email' columns" },
        { status: 400 }
      );
    }

    // Process data rows
    const contacts = [];
    const errors = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      const name = String(row[nameIndex] || "").trim();
      const email = String(row[emailIndex] || "").trim().toLowerCase();

      // Skip empty rows
      if (!name && !email) continue;

      // Validate required fields
      if (!name) {
        errors.push(`Row ${i + 1}: Name is required`);
        continue;
      }

      if (!email) {
        errors.push(`Row ${i + 1}: Email is required`);
        continue;
      }

      if (!emailRegex.test(email)) {
        errors.push(`Row ${i + 1}: Invalid email format: ${email}`);
        continue;
      }

      contacts.push({
        userId,
        name,
        email,
        identification: {
          verified: false,
          active: true,
          primary: false,
        },
      });
    }

    if (contacts.length === 0) {
      return NextResponse.json(
        { error: "No valid contacts found in the Excel file" },
        { status: 400 }
      );
    }

    // Insert contacts (upsert by email to avoid duplicates)
    const results = {
      created: 0,
      updated: 0,
      errors: [],
    };

    for (const contact of contacts) {
      try {
        const existing = await Employee.findOne({
          userId,
          email: contact.email,
        });

        if (existing) {
          await Employee.findByIdAndUpdate(existing._id, {
            name: contact.name,
          });
          results.updated++;
        } else {
          await Employee.create(contact);
          results.created++;
        }
      } catch (err) {
        if (err.code === 11000) {
          results.errors.push(`Duplicate email: ${contact.email}`);
        } else {
          results.errors.push(`Error processing ${contact.email}: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Uploaded successfully: ${results.created} created, ${results.updated} updated`,
      results,
      validationErrors: errors,
    });
  } catch (err) {
    console.error("Upload error:", err);
    return NextResponse.json(
      { error: "Failed to process Excel file: " + err.message },
      { status: 500 }
    );
  }
}
