// models/Employee.js
import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, required: true },
    email: { type: String, required: true },
    identification: {
      verified: { type: Boolean, default: false },
      active: { type: Boolean, default: true },
      primary: { type: Boolean, default: false },
    },
  },
  { timestamps: true }
);

// Compound index to ensure unique email per user
EmployeeSchema.index({ userId: 1, email: 1 }, { unique: true });

export default mongoose.models.Employee ||
  mongoose.model("Employee", EmployeeSchema);
