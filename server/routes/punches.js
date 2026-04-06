const express = require("express");
const { DateTime } = require("luxon");
const Punch = require("../models/Punch");
const authMiddleware = require("../middleware/auth");

const router = express.Router();

// ZK machines are in IST, so we filter using IST day boundaries
const IST = "Asia/Kolkata";

/**
 * GET /api/punches?date=YYYY-MM-DD
 * Protected: requires JWT. Returns only the authenticated user's punches.
 * If no date param, defaults to today (IST).
 * Returns raw ISO timestamps — frontend formats to user's local timezone.
 */
router.get("/", authMiddleware, async (req, res) => {
  try {
    const { employeeId } = req.user;

    let dateStr = req.query.date;

    // Default to today in IST
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      dateStr = DateTime.now().setZone(IST).toFormat("yyyy-MM-dd");
    }

    // Build IST day boundaries (00:00 to 23:59:59.999 IST) then convert to UTC for query
    const dayStartIST = DateTime.fromISO(dateStr, { zone: IST }).startOf("day");
    const dayEndIST = dayStartIST.endOf("day");

    const dayStartUTC = dayStartIST.toJSDate();
    const dayEndUTC = dayEndIST.toJSDate();

    const punches = await Punch.find({
      employeeId,
      timestamp: { $gte: dayStartUTC, $lte: dayEndUTC },
    })
      .sort({ timestamp: 1 })
      .select("type timestamp -_id")
      .lean();

    // Group into ordered in/out pairs — send raw ISO timestamps
    const inPunches = punches.filter((p) => p.type === "in");
    const outPunches = punches.filter((p) => p.type === "out");

    const pairs = [];
    const maxLen = Math.max(inPunches.length, outPunches.length);

    for (let i = 0; i < maxLen; i++) {
      pairs.push({
        in: inPunches[i] ? inPunches[i].timestamp.toISOString() : "",
        out: outPunches[i] ? outPunches[i].timestamp.toISOString() : "",
      });
    }

    res.json({ date: dateStr, pairs });
  } catch (err) {
    console.error("[Punches] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
