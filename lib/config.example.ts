// Template for lib/config.ts (which is gitignored because it holds secrets).
// Copy this file to lib/config.ts and fill in real values, or simply set
// DATABASE_URL and AUTH_SECRET as environment variables instead.

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://user:password@host:6543/postgres";

export const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "generate-a-long-random-hex-string";

// Optional: free key from https://golfcourseapi.com enables in-app course search.
export const GOLF_COURSE_API_KEY = process.env.GOLF_COURSE_API_KEY ?? "";
