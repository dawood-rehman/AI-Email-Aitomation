// app/api/employees/[id]/route.js
import { NextResponse } from "next/server";
import { connectToDB } from "@/lib/db";
import Employee from "@/models/Employee";
import { getUserIdFromRequest } from "@/lib/auth";

export async function PUT(req, { params }) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const { id } = params;
    const body = await req.json();
    const { name, email, identification } = body;

    const updateData = { name, email };
    if (identification) {
      updateData.identification = identification;
    }

    const contact = await Employee.findOneAndUpdate(
      { _id: id, userId },
      updateData,
      { new: true }
    );

    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json(contact);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to update contact" },
      { status: 500 }
    );
  }
}

export async function DELETE(req, { params }) {
  try {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await connectToDB();
    const { id } = params;

    const contact = await Employee.findOneAndDelete({ _id: id, userId });
    if (!contact) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Failed to delete contact" },
      { status: 500 }
    );
  }
}
