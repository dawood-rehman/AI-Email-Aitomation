// app/api/employees/bulk/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";

export async function POST(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const body = await req.json();
    const { employees, deletedIds } = body;

    const results = {
      created: [],
      updated: [],
      deleted: [],
      errors: [],
    };

    // Handle deletions
    if (deletedIds && deletedIds.length > 0) {
      for (const id of deletedIds) {
        try {
          const deleted = await Employee.findOneAndDelete({
            _id: id,
            userId,
          });
          if (deleted) {
            results.deleted.push(id);
          }
        } catch (err) {
          results.errors.push(`Failed to delete ${id}: ${err.message}`);
        }
      }
    }

    // Handle creates and updates
    if (employees && employees.length > 0) {
      for (const emp of employees) {
        try {
          const { id, name, email, role, department } = emp;

          if (!name || !email) {
            results.errors.push(`Employee missing name or email: ${email || "unknown"}`);
            continue;
          }

          // Validate email format
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!emailRegex.test(email)) {
            results.errors.push(`Invalid email format: ${email}`);
            continue;
          }

          if (id) {
            // Update existing
            const updated = await Employee.findOneAndUpdate(
              { _id: id, userId },
              { name, email: email.toLowerCase(), role, department },
              { new: true }
            );
            if (updated) {
              results.updated.push(updated);
            } else {
              results.errors.push(`Employee not found: ${id}`);
            }
          } else {
            // Create new
            try {
              const created = await Employee.create({
                userId,
                name,
                email: email.toLowerCase(),
                role: role || "",
                department: department || "",
              });
              results.created.push(created);
            } catch (err) {
              if (err.code === 11000) {
                results.errors.push(`Employee with email ${email} already exists`);
              } else {
                results.errors.push(`Failed to create ${email}: ${err.message}`);
              }
            }
          }
        } catch (err) {
          results.errors.push(`Error processing employee: ${err.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (err) {
    console.error("Bulk operation error:", err);
    return NextResponse.json(
      { error: "Failed to process bulk operation" },
      { status: 500 }
    );
  }
}

