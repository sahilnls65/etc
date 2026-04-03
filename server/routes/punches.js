const express = require("express");
const Punch = require("../models/Punch");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

/**
 * GET /api/punches?date=YYYY-MM-DD
 * Protected: requires JWT. Returns only the authenticated user's punches.
 * If no date param, defaults to today.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.user;

    // Parse date param or default to today
    let dateStr = req.query.date;
    let dayStart, dayEnd;

    if (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dayStart = new Date(dateStr + "T00:00:00.000Z");
      dayEnd = new Date(dateStr + "T23:59:59.999Z");
    } else {
      const now = new Date();
      const y = now.getFullYear();
      const m = String(now.getMonth() + 1).padStart(2, "0");
      const d = String(now.getDate()).padStart(2, "0");
      dateStr = `${y}-${m}-${d}`;
      dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
    }

    const punches = await Punch.find({
      employeeId,
      timestamp: { $gte: dayStart, $lte: dayEnd },
    })
      .sort({ timestamp: 1 })
      .select("type timestamp -_id")
      .lean();

    // Group into ordered in/out pairs
    const inPunches = punches.filter((p) => p.type === "in");
    const outPunches = punches.filter((p) => p.type === "out");

    const pairs = [];
    const maxLen = Math.max(inPunches.length, outPunches.length);

    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        in: inPunches[i]
          ? formatTimeHHMM(new Date(inPunches[i].timestamp))
          : "",
        out: outPunches[i]
          ? formatTimeHHMM(new Date(outPunches[i].timestamp))
          : "",
      });
    }

    res.json({ date: dateStr, pairs });
  } catch (err) {
    console.error("[Punches] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

/** Format a Date to "HH:mm" in local timezone */
function formatTimeHHMM(date) {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  return `${h}:${m}`;
}

module.exports = router;
