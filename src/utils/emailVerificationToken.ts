import jwt from "jsonwebtoken";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

const EMAIL_VERIFICATION_PURPOSE = "email-verification";

interface PendingCredentials {
  id_usuario: number;
  email: string;
  senha: string;
}

function credentialVersion(user: PendingCredentials): string {
  return createHmac("sha256", env.EMAIL_VERIFICATION_SECRET!)
    .update(JSON.stringify([user.id_usuario, user.email, user.senha]))
    .digest("hex");
}

export function matchesEmailVerificationToken(version: string, user: PendingCredentials): boolean {
  const expected = Buffer.from(credentialVersion(user), "hex");
  const supplied = Buffer.from(version, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createEmailVerificationToken(user: PendingCredentials): string {
  return jwt.sign(
    { userId: user.id_usuario, purpose: EMAIL_VERIFICATION_PURPOSE, version: credentialVersion(user) },
    env.EMAIL_VERIFICATION_SECRET!,
    { expiresIn: "24h", algorithm: "HS256" }
  );
}

export function readEmailVerificationToken(token: string): { userId: number; version: string } {
  try {
    const payload = jwt.verify(token, env.EMAIL_VERIFICATION_SECRET!, { algorithms: ["HS256"] });

    if (
      typeof payload === "string" ||
      payload.purpose !== EMAIL_VERIFICATION_PURPOSE ||
      !Number.isSafeInteger(payload.userId) || payload.userId <= 0 ||
      typeof payload.version !== "string" || !/^[a-f0-9]{64}$/.test(payload.version)
    ) {
      throw new Error("Invalid email verification token payload");
    }

    return { userId: payload.userId, version: payload.version };
  } catch {
    throw new AppError("O link de confirmação é inválido ou expirou. Solicite um novo e-mail de confirmação.", 400);
  }
}
