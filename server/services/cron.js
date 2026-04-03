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

  task = cron.schedule(config.cron.schedule, async () => {
    const hour = new Date().getHours();
    if (hour >= 0 && hour < 8) {
      console.log(`[Cron] Skipping sync — outside working hours (${hour}:00)`);
      return;
    }
    try {
      await syncAttendance();
    } catch (err) {
      console.error("[Cron] Sync failed:", err.message);
    }
  });

  // Also run once on startup (after a short delay to let DB connect)
  setTimeout(async () => {
    console.log("[Cron] Running initial sync...");
    try {
      await syncAttendance();
    } catch (err) {
      console.error("[Cron] Initial sync failed:", err.message);
    }
  }, 3000);
}

function stopCron() {
  if (task) {
    task.stop();
    task = null;
    console.log("[Cron] Stopped");
  }
}

module.exports = { startCron, stopCron };
