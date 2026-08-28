// Template for local development secrets.
//
// lib/config.ts is committed and reads everything from the environment, so
// there is nothing to copy into it. Instead, create a gitignored .env.local in
// the project root with these keys:
//
//   DATABASE_URL=postgresql://user:password@host:6543/postgres
//   AUTH_SECRET=generate-a-long-random-hex-string
//   GOLF_COURSE_API_KEY=optional-free-key-from-golfcourseapi.com
//   RESEND_API_KEY=optional-key-from-resend.com-for-password-reset-emails
//   EMAIL_FROM=20 Ball <noreply@20ball.golf>       (optional; this is the default)
//   APP_ORIGIN=http://localhost:3000               (optional; emailed links, prod default)
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
