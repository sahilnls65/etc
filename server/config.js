require("dotenv").config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://localhost:27017/etc_time_calculator",

  jwt: {
    secret: process.env.JWT_SECRET || "CHANGE_ME_IN_PRODUCTION",
    expiresIn: process.env.JWT_EXPIRES_IN || "12h",
  },

  zk: {
    inIp: process.env.ZK_IN_IP || "192.168.0.208",
    outIp: process.env.ZK_OUT_IP || "192.168.0.209",
    port: parseInt(process.env.ZK_PORT, 10) || 4370,
    timeout: parseInt(process.env.ZK_TIMEOUT, 10) || 10000,
  },

  cron: {
    enabled: process.env.CRON_ENABLED !== "false", // default: true
    schedule: process.env.CRON_SCHEDULE || "*/15 * * * *",
  },

  webhook: {
    enabled: process.env.WEBHOOK_ENABLED !== "false", // default: true
    secret: process.env.WEBHOOK_SECRET || "",
  },
};
