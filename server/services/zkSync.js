const ZKLib = require("zklib");
const Punch = require("../models/Punch");
const config = require("../config");

/**
 * Connect to a ZKTeco machine and fetch attendance logs.
 */
function fetchAttendance(ip) {
  return new Promise((resolve, reject) => {
    const inport = 10000 + Math.floor(Math.random() * 50000);
    const zk = new ZKLib({
      ip,
      port: config.zk.port,
      timeout: config.zk.timeout,
      inport,
    });

    zk.connect(function (err) {
      if (err) return reject(err);

      zk.getAttendance(function (err, logs) {
        zk.disconnect();
        if (err) return reject(err);
        resolve(logs || []);
      });
    });
  });
}

/**
 * Sync attendance from both IN and OUT machines.
 * Fetches today's logs, deduplicates against DB, and inserts new punches.
 * Returns { inserted, skipped } counts.
 */
async function syncAttendance() {
  const startTime = Date.now();
  console.log("[ZKSync] Starting sync...");

  let inLogs = [];
  let outLogs = [];

  try {
    [inLogs, outLogs] = await Promise.all([
      fetchAttendance(config.zk.inIp),
      fetchAttendance(config.zk.outIp),
    ]);
  } catch (err) {
    console.error("[ZKSync] Machine fetch error:", err.message);
    // Continue with whatever we got — partial sync is better than no sync
  }

  const today = new Date().toISOString().slice(0, 10);

  // Filter to today's logs only
  const todayIn = inLogs.filter(
    (log) => new Date(log.timestamp).toISOString().slice(0, 10) === today
  );
  const todayOut = outLogs.filter(
    (log) => new Date(log.timestamp).toISOString().slice(0, 10) === today
  );

  // Build punch records
  const punchRecords = [];

  for (const log of todayIn) {
    punchRecords.push({
      employeeId: String(log.id),
      type: "in",
      timestamp: new Date(log.timestamp),
      machineIp: config.zk.inIp,
    });
  }

  for (const log of todayOut) {
    punchRecords.push({
      employeeId: String(log.id),
      type: "out",
      timestamp: new Date(log.timestamp),
      machineIp: config.zk.outIp,
    });
  }

  // Insert with deduplication (unique index on employeeId + type + timestamp)
  let inserted = 0;
  let skipped = 0;

  for (const record of punchRecords) {
    try {
      await Punch.create(record);
      inserted++;
    } catch (err) {
      if (err.code === 11000) {
        // Duplicate key — already synced
        skipped++;
      } else {
        console.error("[ZKSync] Insert error:", err.message);
      }
    }
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(
    `[ZKSync] Done in ${elapsed}s — ${inserted} inserted, ${skipped} skipped (${todayIn.length} in + ${todayOut.length} out logs)`
  );

  return { inserted, skipped };
}

module.exports = { syncAttendance, fetchAttendance };
