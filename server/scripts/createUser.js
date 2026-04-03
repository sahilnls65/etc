/**
 * CLI script to create a user manually.
 *
 * Usage:
 *   node scripts/createUser.js <employeeId> <name> <password>
 *
 * Example:
 *   node scripts/createUser.js 101 "Sahil Trambadiya" mypassword123
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const bcrypt = require("bcrypt");
const config = require("../config");
const User = require("../models/User");

const BCRYPT_ROUNDS = 10;

async function main() {
  const [, , employeeId, name, password] = process.argv;

  if (!employeeId || !name || !password) {
    console.error("Usage: node scripts/createUser.js <employeeId> <name> <password>");
    console.error('Example: node scripts/createUser.js 101 "Sahil T" mypass123');
    process.exit(1);
  }

  try {
    await mongoose.connect(config.mongoUri);
    console.log("[DB] Connected");

    // Check if user already exists
    const existing = await User.findOne({ employeeId: employeeId.trim() });
    if (existing) {
      console.error(`User with employeeId "${employeeId}" already exists.`);
      process.exit(1);
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = await User.create({
      employeeId: employeeId.trim(),
      name: name.trim(),
      passwordHash,
    });

    console.log("User created successfully:");
    console.log(`  Employee ID: ${user.employeeId}`);
    console.log(`  Name:        ${user.name}`);
    console.log(`  ID:          ${user._id}`);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

main();
