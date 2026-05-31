// models/Email.js
import mongoose from "mongoose";

const RecipientSchema = new mongoose.Schema(
  {
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    name: { type: String, required: true },
    email: { type: String, required: true },
  },
  { _id: false }
);

const EmailSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: "Employee" },
    to: { type: String, required: true },
    toName: { type: String },
    recipients: { type: [RecipientSchema], default: [] },
    cc: [{ type: String }],
    subject: { type: String, required: true },
    body_html: { type: String, required: true },
    from: { type: String, required: true },
    fromName: { type: String, required: true },
    sentAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Index for faster queries
EmailSchema.index({ userId: 1, employeeId: 1 });
EmailSchema.index({ userId: 1, to: 1 });
EmailSchema.index({ userId: 1, "recipients.email": 1 });
EmailSchema.index({ sentAt: -1 });

export default mongoose.models.Email || mongoose.model("Email", EmailSchema);

