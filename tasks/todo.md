# Backend + Secure API + ZKLib Cron Integration

## Plan

### Architecture
- **Backend:** Node.js + Express
- **Database:** SQLite (lightweight, no external DB server needed)
- **Auth:** JWT tokens + bcrypt(10) password hashing
- **Cron:** node-cron every 15min to fetch from ZK biometric machines
- **Security:** JWT middleware, employee_id scoped queries (users can only see their own data)
- **Frontend:** Read-only punch display (no manual add/now buttons), fetches from API

### Directory Structure
```
server/
  ├── index.js          # Express server entry
  ├── config.js         # DB path, JWT secret, machine IPs, cron schedule
  ├── db.js             # SQLite setup + schema
  ├── middleware/
  │   └── auth.js       # JWT verification middleware
  ├── routes/
  │   ├── auth.js       # POST /api/auth/login
  │   └── punches.js    # GET /api/punches?date=YYYY-MM-DD
  ├── services/
  │   ├── zkSync.js     # ZKLib fetch + dedupe + store
  │   └── cron.js       # node-cron scheduler
  └── scripts/
      └── createUser.js # CLI to manually create users with bcrypt
```

### Database Schema
- **users**: id, employee_id (unique), name, password_hash, created_at
- **punches**: id, employee_id, type (in/out), timestamp (unique per employee+type+timestamp), machine_ip, synced_at

### Tasks

- [ ] 1. Create server directory structure + package.json + install deps
- [ ] 2. Setup SQLite database with schema (users + punches tables)
- [ ] 3. Create config.js with env-based settings
- [ ] 4. Build auth middleware (JWT verify + employee_id scoping)
- [ ] 5. Build login route (POST /api/auth/login) — bcrypt verify, return JWT
- [ ] 6. Build punches route (GET /api/punches) — date filter, employee_id from JWT
- [ ] 7. Build ZKLib sync service — fetch from both machines, dedupe, store
- [ ] 8. Setup node-cron to run ZKLib sync every 15 minutes
- [ ] 9. Create CLI script to manually create users (bcrypt 10 rounds)
- [ ] 10. Create server entry point (index.js) wiring everything together
- [ ] 11. Update frontend: add API service, login page, read-only punch view
- [ ] 12. Update vite config for API proxy in dev mode
- [ ] 13. Test build + verify everything works
