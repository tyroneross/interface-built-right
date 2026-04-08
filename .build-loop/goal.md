# Fix Chrome Debugger Timeout After Many Sessions

**Goal**: Fix the "Chrome debugger did not respond within 5s on port" error that occurs after opening many IBR sessions.

## Scoring Criteria

| # | Criterion | Method | Pass |
|---|-----------|--------|------|
| 1 | Chrome PID stored and killed on cleanup | Code inspection | `stopBrowserServer()` kills Chrome process, not just deletes state file |
| 2 | SingletonLock checked for all profiles | Code inspection | Lock check runs regardless of `options.userDataDir` |
| 3 | Port collision prevention | Code inspection | Port verified free before Chrome launch |
| 4 | Stale session cleanup | Code inspection | `live-session.json` deleted on session close |
| 5 | Build passes | `npm run build` | Exit 0 |
| 6 | IBR start works after 5+ sessions | Manual test | `npx ibr start` succeeds reliably |
