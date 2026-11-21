import { env } from "../config/env.js";

// GOOGLE_CLIENT_ID aceita vários IDs separados por vírgula (web, Android e iOS).
export const googleAudiences: string[] = (env.GOOGLE_CLIENT_ID ?? "")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);