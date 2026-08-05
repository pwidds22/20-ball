// Template for local development secrets.
//
// lib/config.ts is committed and reads everything from the environment, so
// there is nothing to copy into it. Instead, create a gitignored .env.local in
// the project root with these keys:
//
//   DATABASE_URL=postgresql://user:password@host:6543/postgres
//   AUTH_SECRET=generate-a-long-random-hex-string
//   GOLF_COURSE_API_KEY=optional-free-key-from-golfcourseapi.com
//
// Generate an AUTH_SECRET with:
//   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
//
// For deployments, set the same names in the Vercel project's environment
// variables (all environments you build for — Production and Preview).
//
// GOLF_COURSE_API_KEY is optional: it enables in-app course search (pars and
// stroke indexes for ~30k courses). Leave it unset and the feature hides.

export {};
