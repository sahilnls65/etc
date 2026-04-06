const ZKLib = require("zklib");
const { DateTime } = require("luxon");
const Punch = require("../models/Punch");
const config = require("../config");

// ZK machines are in IST — always use IST for date filtering
const IST = "Asia/Kolkata";

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
 * Convert a ZK machine timestamp to a proper UTC Date.
 * ZK machines store local IST time. zklib creates Date objects using
 * the server's timezone, which may not be IST. This function extracts
 * the raw hour/minute/second values and reinterprets them as IST,
 * then converts to UTC for correct MongoDB storage.
 */
function zkTimestampToUTC(rawTimestamp) {
  const d = new Date(rawTimestamp);
  // Extract the wall-clock components (these represent IST time on the machine)
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hour = d.getHours();
  const minute = d.getMinutes();
  const second = d.getSeconds();

  // Rebuild as IST, then convert to JS Date (UTC internally)
  const istDt = DateTime.fromObject(
    { year, month, day, hour, minute, second },
    { zone: IST }
  );
  return istDt.toJSDate();
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

  // Use IST date for "today" filtering (not UTC)
  const todayIST = DateTime.now().setZone(IST).toFormat("yyyy-MM-dd");

  // Filter to today's logs only (compare in IST)
  const isToday = (rawTimestamp) => {
    const d = new Date(rawTimestamp);
    const dtIST = DateTime.fromObject(
      {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        day: d.getDate(),
      },
      { zone: IST }
    );
    return dtIST.toFormat("yyyy-MM-dd") === todayIST;
  };

  const todayIn = inLogs.filter((log) => isToday(log.timestamp));
  const todayOut = outLogs.filter((log) => isToday(log.timestamp));

  // Build punch records with proper UTC timestamps
  const punchRecords = [];

  for (const log of todayIn) {
    punchRecords.push({
      employeeId: String(log.id),
      type: "in",
      timestamp: zkTimestampToUTC(log.timestamp),
      machineIp: config.zk.inIp,
    });
  }

  for (const log of todayOut) {
    punchRecords.push({
      employeeId: String(log.id),
      type: "out",
      timestamp: zkTimestampToUTC(log.timestamp),
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
