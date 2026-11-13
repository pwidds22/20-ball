# 20 Ball

A live-syncing web app for 20 Ball and 40 Ball, team golf games where you can't
see which scores the other team is keeping.

**Play it:** [www.20ball.golf](https://www.20ball.golf)

## How the game works

- Two teams play 18 holes. **20 Ball** is 2 v 2 and each team keeps 20 of its 36
  scores; **40 Ball** is 4 v 4 and each team keeps 40 of 72.
- Hole by hole, each team picks which scores to keep. Once a hole is locked in,
  the choice is final.
- You can't see which scores the other team kept. Skip too many holes waiting
  for something better, and a late blow-up you're forced to keep can sink you.
- Scoring is net, with handicap strokes off the lowest handicap in the group.

## Tech stack

- **Next.js** (App Router) for the UI and API routes
- **Supabase Postgres** in an isolated `twentyball` schema with a dedicated app role
- Username/password auth with signed JWT cookies (`jose` + `bcryptjs`)
- Deployed on **Vercel**

All game rules run on the server. The rules engine (`lib/engine.ts`) is pure and
dependency-free, with unit tests in `scripts/`. Hidden scores are enforced
server-side, not just hidden in the UI.

## Built with Claude Code

This project is built with [Claude Code](https://claude.com/claude-code).
[`CLAUDE.md`](CLAUDE.md) holds the project guidelines it works from.
[`VISION.md`](VISION.md) and [`ROADMAP.md`](ROADMAP.md) describe where the
project is going.

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env.local` file in the project root. It is gitignored.
   [`lib/config.example.ts`](lib/config.example.ts) lists every variable:

   | Variable | Required | Purpose |
   |---|---|---|
   | `DATABASE_URL` | Yes | Postgres connection string |
   | `AUTH_SECRET` | Yes | Long random string that signs session tokens |
   | `GOLF_COURSE_API_KEY` | No | Enables course search ([golfcourseapi.com](https://golfcourseapi.com)) |
   | `RESEND_API_KEY` | No | Enables password-reset emails ([resend.com](https://resend.com)) |
   | `EMAIL_FROM`, `APP_ORIGIN` | No | Email sender and link origin |

   Generate an `AUTH_SECRET` with:

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```

3. Start the dev server on port 3000:

   ```bash
   npm run dev
   ```

Run the engine tests:

```bash
node --experimental-strip-types scripts/engine.test.ts
```
