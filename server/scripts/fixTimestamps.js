/**
 * One-time migration script: Fix existing punch timestamps.
 *
 * Problem: VPS timezone is UTC, but ZK machines store IST time.
 * The old code did `new Date(log.timestamp)` which interpreted IST
 * wall-clock values as UTC — storing them 5h 30m ahead of correct UTC.
 *
 * Fix: Subtract 5 hours 30 minutes from every existing punch timestamp.
 *
 * Usage: node scripts/fixTimestamps.js
 *        node scripts/fixTimestamps.js --dry-run   (preview only)
 */

require("dotenv").config({ path: require("path").join(__dirname, "../.env") });
const mongoose = require("mongoose");
const Punch = require("../models/Punch");

const OFFSET_MS = (5 * 60 + 30) * 60 * 1000; // 5h 30m in milliseconds
const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");

  const punches = await Punch.find({}).sort({ timestamp: 1 });
  console.log(`Found ${punches.length} punch records`);

  if (punches.length === 0) {
    console.log("Nothing to fix.");
    await mongoose.disconnect();
    return;
  }

  if (DRY_RUN) {
    console.log("\n--- DRY RUN (no changes will be made) ---\n");
    for (const p of punches) {
      const oldTime = p.timestamp.toISOString();
      const newTime = new Date(p.timestamp.getTime() - OFFSET_MS).toISOString();
      console.log(
        `[${p.employeeId}] ${p.type.toUpperCase().padEnd(3)} : ${oldTime}  →  ${newTime}`
      );
    }
    console.log(`\n${punches.length} records would be updated.`);
  } else {
    const result = await Punch.updateMany(
      {},
      [
        {
          $set: {
            timestamp: {
              $subtract: ["$timestamp", OFFSET_MS],
            },
          },
        },
      ]
    );
    console.log(`Updated ${result.modifiedCount} records (shifted back 5h 30m)`);
  }

  await mongoose.disconnect();
  console.log("Done.");
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
