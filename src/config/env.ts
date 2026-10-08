import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória."),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória."),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN é obrigatória."),
  GOOGLE_CLIENT_ID: z.string().optional(),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Variáveis de ambiente inválidas:", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;