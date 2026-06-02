// lib/db.js
import mongoose from "mongoose";

let cached = global._mongoose;

if (!cached) {
  cached = global._mongoose = { conn: null, promise: null };
}

export async function connectToDB() {
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error("Please define the MONGODB_URI environment variable");
  }

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose
      .connect(MONGODB_URI, {
        bufferCommands: false,
      })
      .then((mongoose) => mongoose);
  }

  cached.conn = await cached.promise;
  return cached.conn;
}
