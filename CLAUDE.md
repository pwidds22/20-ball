# 20 Ball — Claude Code guidelines

Hidden-information team golf game (20 Ball = 2v2 keep 20; 40 Ball = 4v4 keep 40).
See **`VISION.md`** for the long-term direction: a platform for playing any golf
game format with friends, where the core value is computing fair per-format
handicap strokes. **End goal is a native mobile app** — the current web app is an
API-first bridge, so keep game logic on the server (native will reuse it).

> ⚠️ This Next.js has breaking changes vs. training data — read the relevant
> guide in `node_modules/next/dist/docs/` before writing Next.js code (see AGENTS.md).

## Commands
```bash
npm run dev                                             # dev server, port 3000
npm run build                                           # prod build + typecheck
node --experimental-strip-types scripts/engine.test.ts  # engine unit tests
npx vercel deploy --prod --yes                          # deploy to prod (20ball.golf)
```
Code lives at `github.com/pwidds22/20-ball` (private). `git push` and `vercel deploy`
are separate steps — deploys are NOT git-triggered.

## Architecture
```
app/
  page.tsx                # dashboard: auth + game list
  new/  join/  g/[code]/  # create, join, live game screen
  api/                    # ALL server logic (auth, games, scores, peek, decide, finalize, courses)
lib/
  engine.ts        # PURE rules engine — strokes, keep math, scoring, optimal. No deps, unit-tested.
  game-server.ts   # loads a game + REDACTS opponent data per viewer (buildState); parseJsonb lives here
  db.ts  auth.ts  config.ts   # postgres client · JWT session · secrets (gitignored)
components/         # setup editors + game/ views (hole, card, game tabs) + ui primitives
scripts/engine.test.ts   # run with: node --experimental-strip-types
```

## Key patterns
- **API-first.** All rules/scoring live in `app/api/` + `lib/`; the browser is a
  thin client. Don't bury game logic in components — the native app reuses this backend.
- **`lib/engine.ts` is pure and dependency-free.** Any rules change → add/adjust a
  case in `scripts/engine.test.ts` and run it. It's the highest-value code.
- **Hidden info is enforced server-side** in `buildState` (game-server.ts): a viewer
  never receives the opponent's kept scores except via peek / scheduled reveal /
  final. Never leak opponent data into an API response.
- **Play-order model:** teams can start on any hole; ordering rules use
  `orderIndex(hole, startHole)`, not the raw hole number.
- Route shape: `requireSession()` → check membership/team → validate input → mutate.

## Gotchas (these have bitten us)
- **jsonb comes back as a STRING.** The Supabase transaction pooler needs
  `prepare: false`, which disables type parsing — so `settings`/`holes`/`snapshot`
  arrive as strings. Parse them with `parseJsonb()` (game-server.ts).
- **Never run `next build` while `npm run dev` is running** — it corrupts `.next`
  and the dev server starts returning 500s. Recovery: stop dev, `rm -rf .next`, restart.
- **Secrets** (DB URL, `AUTH_SECRET`, `GOLF_COURSE_API_KEY`) live in gitignored
  `lib/config.ts`; they ship to Vercel via `.vercelignore` (which replaces
  .gitignore for uploads). Same-named real env vars override. **Never commit
  secrets or put them in this file.**
- **Apex `20ball.golf` 308-redirects to `www`** — fine for browsers; only matters
  for scripts that disable redirect-following (use `www.20ball.golf` there).

## Database
- Dedicated Supabase project (connection in `lib/config.ts`). Schema `twentyball`;
  app connects as the limited `twentyball_app` role.
- Child tables (`players`, `members`, `scores`, `peeks`, `alerts`) cascade-delete
  off `games.id`. But `games.created_by → users` has **no** cascade — delete a
  user's games before the user.
- Apply schema changes via the Supabase MCP `apply_migration`, not ad-hoc SQL.
- Testing against prod: use throwaway accounts and clean them up after (games first,
  then users). The user's real accounts/games must stay untouched.

## Conventions
- Match the surrounding code (naming, comment density, idioms).
- Prefer small, verifiable changes; run engine tests + `npm run build` before deploying.
- After a nontrivial change, verify behavior in a browser against prod, don't just typecheck.

@AGENTS.md
