const express = require("express");
const router = express.Router();
const config = require("../config");
const Punch = require("../models/Punch");

/**
 * Webhook authentication middleware.
 * Supports the same auth formats as the timetrack sender:
 *   - Bearer token:  Authorization: Bearer <token>
 *   - API key:       x-api-key: <key>
 *
 * The server validates against WEBHOOK_SECRET in .env
 */
function webhookAuth(req, res, next) {
  const secret = config.webhook.secret;

  if (!secret) {
    console.warn("[Webhook] No WEBHOOK_SECRET configured — rejecting all requests");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.headers["authorization"] || "";
  if (authHeader === `Bearer ${secret}` || authHeader === secret) {
    return next();
  }

  // Check x-api-key header
  const apiKey = req.headers["x-api-key"] || "";
  if (apiKey === secret) {
    return next();
  }

  return res.status(401).json({ error: "Unauthorized" });
}

/**
 * POST /api/webhook/attendance
 *
 * Receives an array of punch records from the timetrack service.
 * Expected payload:
 * [
 *   {
 *     "employeeId": "101",
 *     "type": "in",
 *     "timestamp": "2026-04-08T03:30:00.000Z",
 *     "machineIp": "192.168.0.208"
 *   },
 *   ...
 * ]
 *
 * Deduplicates against existing records (unique index) and inserts new ones.
 */
router.post("/attendance", webhookAuth, async (req, res) => {
  try {
    const records = req.body;

    // Validate payload
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: "Payload must be a JSON array" });
    }

    if (records.length === 0) {
      return res.json({ inserted: 0, skipped: 0, errors: 0 });
    }

    let inserted = 0;
    let skipped = 0;
    let errors = 0;

    for (const record of records) {
      // Validate each record
      if (!record.employeeId || !record.type || !record.timestamp) {
        errors++;
        continue;
      }

      if (!["in", "out"].includes(record.type)) {
        errors++;
        continue;
      }

      try {
        await Punch.create({
          employeeId: String(record.employeeId),
          type: record.type,
          timestamp: new Date(record.timestamp),
          machineIp: record.machineIp || "",
        });
        inserted++;
      } catch (err) {
        if (err.code === 11000) {
          // Duplicate — already exists
          skipped++;
        } else {
          errors++;
          console.error("[Webhook] Insert error:", err.message);
        }
      }
    }

    console.log(
      `[Webhook] Received ${records.length} records — ${inserted} inserted, ${skipped} skipped, ${errors} errors`
    );

    res.json({ inserted, skipped, errors });
  } catch (err) {
    console.error("[Webhook] Error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
