# 20 Ball 🏌️

The two-man (and four-man) team golf game of nerve, as a live-syncing web app.

**Play it:** [20-ball.vercel.app](https://20-ball.vercel.app)

## The game

Two teams. Each team keeps a fixed number of the scores its players shoot across
18 holes — **20 Ball** is 2 v 2, keep 20 of 36; **40 Ball** is 4 v 4, keep 40 of
72. You choose which scores to keep, hole by hole, and once you lock a hole in
it's final. The catch: you can't see which scores the other team is keeping, so
you're playing blind — skip too many holes waiting for something better and a
late blow-up you're forced to keep can sink you. Net scoring off the lowest
handicap in the group.

## Stack

- **Next.js** (App Router) — UI + API routes
- **Supabase Postgres** — data (isolated `twentyball` schema, dedicated app role)
- Username/password auth via signed JWT cookies (`jose` + `bcryptjs`)
- Deployed on **Vercel**

The rules engine (`lib/engine.ts`) is pure and dependency-free, with unit tests
in `scripts/engine.test.ts`.

## Local setup

```bash
npm install
cp lib/config.example.ts lib/config.ts   # then fill in DATABASE_URL + AUTH_SECRET
npm run dev
```

Secrets live in `lib/config.ts` (gitignored) or real environment variables of
the same name (`DATABASE_URL`, `AUTH_SECRET`, and the optional
`GOLF_COURSE_API_KEY` for in-app course search). Environment variables always
win over the file, so production reads them from the Vercel project settings.

Run the engine tests:

```bash
node --experimental-strip-types scripts/engine.test.ts
```

## Features

- 20 Ball (2 v 2) and 40 Ball (4 v 4)
- Hidden opponent scores — enforced server-side, not just in the UI
- Per-hole lock-in with a confirmation; decisions are final (or alerted-on-change)
- Course search (golfcourseapi.com) plus a hand-editable scorecard
- Handicap strokes off the low player, with par-3 and allowance options
- Shotgun / split-tee starts (each team can start on any hole)
- Peeks, scheduled reveals, per-team finish with a private recap
- Final card with per-player Used credit and to-par contribution
