// Runtime configuration. Committed on purpose and secret-free: every value
// comes from the environment.
//
//   deployments → Vercel project environment variables
//   local dev    → .env.local (gitignored by the .env* rule; Next loads it)
//
// This file used to be gitignored and carry the secrets inline, which meant it
// was missing from the repo — so any GitHub-triggered build died on
// "Module not found: Can't resolve './config'" and only CLI deploys (which
// upload it via .vercelignore) could succeed.

function required(name: string): string {
  const value = process.env[name];
  if (!value)
    throw new Error(
      `Missing required environment variable ${name}. Set it in the Vercel ` +
        `project settings for deployments, or in .env.local for local ` +
        `development (see lib/config.example.ts).`
    );
  return value;
}

export const DATABASE_URL = required("DATABASE_URL");

// Signs session JWTs. Empty would silently sign with a guessable key, so this
// fails loudly rather than defaulting.
export const AUTH_SECRET = required("AUTH_SECRET");

// Optional: free key from https://golfcourseapi.com enables in-app course
// search (pars + stroke indexes for ~30k courses). Empty = feature hidden.
export const GOLF_COURSE_API_KEY = process.env.GOLF_COURSE_API_KEY ?? "";
