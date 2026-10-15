import "dotenv/config";
import { z } from "zod";

const optionalEnvString = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().trim().optional()
);

const optionalEmailEnv = z.preprocess(
  (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
  z.string().email().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL é obrigatória."),
  JWT_SECRET: z.string().min(1, "JWT_SECRET é obrigatória."),
  EMAIL_VERIFICATION_SECRET: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().min(32, "EMAIL_VERIFICATION_SECRET deve ter pelo menos 32 caracteres.").optional()
  ),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().min(1, "CORS_ORIGIN é obrigatória."),
  GOOGLE_CLIENT_ID: optionalEnvString,
  FRONTEND_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().optional()
  ),
  // Brevo (antigo Sendinblue) - API REST via HTTPS (porta 443)
  BREVO_API_KEY: optionalEnvString,
  BREVO_SENDER_EMAIL: optionalEmailEnv,
  BREVO_SENDER_NAME: optionalEnvString.default("Cifra Wealth"),
  // Suporte a URL customizada da Brevo (para testes/mocks)
  BREVO_API_URL: z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    z.string().url().default("https://api.brevo.com/v3/smtp/email")
  ),
});

const parsedEnv = envSchema.safeParse(process.env);

if (!parsedEnv.success) {
  console.error("Variáveis de ambiente inválidas:", parsedEnv.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsedEnv.data;