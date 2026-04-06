const cron = require("node-cron");
const config = require("../config");
const { syncAttendance } = require("./zkSync");

let task = null;

function startCron() {
  if (task) {
    console.log("[Cron] Already running");
    return;
  }

  console.log(`[Cron] Scheduling ZK sync: "${config.cron.schedule}"`);

  const { DateTime } = require("luxon");

  task = cron.schedule(config.cron.schedule, async () => {
    // Use Indian Standard Time (IST = UTC+5:30)
    const nowIST = DateTime.now().setZone("Asia/Kolkata");
    const hour = nowIST.hour;
    const day = nowIST.weekday; // 1 = Monday, ..., 7 = Sunday

    // Exclude Saturday (6) and Sunday (7)
    if (day === 6 || day === 7) {
      console.log(`[Cron] Skipping sync — Weekend (${nowIST.toFormat("cccc")})`);
      return;
    }
    // Only run between 8:00 - 23:59 IST (exclude 0-7)
    if (hour < 8) {
      console.log(`[Cron] Skipping sync — outside working hours (${hour}:00 IST)`);
      return;
    }
    try {
      await syncAttendance();
    } catch (err) {
      console.error("[Cron] Sync failed:", err.message);
    }
  });

  // Also run once on startup (after a short delay to let DB connect)
  // setTimeout(async () => {
  //   console.log("[Cron] Running initial sync...");
  //   try {
  //     await syncAttendance();
  //   } catch (err) {
  //     console.error("[Cron] Initial sync failed:", err.message);
  //   }
  // }, 3000);
}

function stopCron() {
  if (task) {
    task.stop();
    task = null;
    console.log("[Cron] Stopped");
  }
}

module.exports = { startCron, stopCron };
