const mongoose = require("mongoose");
const config = require("./config");

async function connectDB() {
  try {
    await mongoose.connect(config.mongoUri);
    console.log("[DB] Connected to MongoDB");
  } catch (err) {
    console.error("[DB] Connection failed:", err.message);
    process.exit(1);
  }
}

module.exports = connectDB;
