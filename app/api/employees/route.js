// app/api/employees/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";

export async function GET(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const contacts = await Employee.find({ userId }).sort({ createdAt: -1 });
    return NextResponse.json(contacts);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const body = await req.json();
    const { name, email, identification } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "Name and email are required" },
        { status: 400 }
      );
    }

    const employee = await Employee.create({ 
      userId, 
      name, 
      email, 
      identification: identification || { verified: false, active: true, primary: false }
    });
    return NextResponse.json(employee);
  } catch (err) {
    console.error(err);
    if (err.code === 11000) {
      return NextResponse.json(
        { error: "Contact with this email already exists" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
