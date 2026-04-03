const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const config = require("../config");

const router = express.Router();

/**
 * POST /api/auth/login
 * Body: { employeeId, password }
 * Returns: { token, user: { employeeId, name } }
 */
router.post("/login", async (req, res) => {
  try {
    const { employeeId, password } = req.body;

    if (!employeeId || !password) {
      return res.status(400).json({ error: "Employee ID and password are required" });
    }

    const user = await User.findOne({ employeeId: String(employeeId).trim() });

    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);

    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { sub: user._id, employeeId: user.employeeId },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    res.json({
      token,
      user: {
        employeeId: user.employeeId,
        name: user.name,
      },
    });
  } catch (err) {
    console.error("[Auth] Login error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
