const mongoose = require("mongoose");

const punchSchema = new mongoose.Schema(
  {
    employeeId: {
      type: String,
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["in", "out"],
      required: true,
    },
    timestamp: {
      type: Date,
      required: true,
    },
    machineIp: {
      type: String,
    },
    syncedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Compound unique index: prevent duplicate punches
punchSchema.index(
  { employeeId: 1, type: 1, timestamp: 1 },
  { unique: true }
);

// Index for date-range queries
punchSchema.index({ employeeId: 1, timestamp: -1 });

module.exports = mongoose.model("Punch", punchSchema);
