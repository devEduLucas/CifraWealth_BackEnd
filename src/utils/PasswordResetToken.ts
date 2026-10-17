import jwt from "jsonwebtoken";
import { createHmac, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

const PASSWORD_RESET_PURPOSE = "password-reset";

interface UserWithCredentials {
  id_usuario: number;
  email: string;
  senha: string | null;
}

function credentialVersion(user: UserWithCredentials): string {
  return createHmac("sha256", env.JWT_SECRET)
    .update(JSON.stringify([user.id_usuario, user.email, user.senha]))
    .digest("hex");
}

export function matchesPasswordResetToken(version: string, user: UserWithCredentials): boolean {
  const expected = Buffer.from(credentialVersion(user), "hex");
  const supplied = Buffer.from(version, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function createPasswordResetToken(user: UserWithCredentials): string {
  return jwt.sign(
    { userId: user.id_usuario, purpose: PASSWORD_RESET_PURPOSE, version: credentialVersion(user) },
    env.JWT_SECRET,
    { expiresIn: "1h", algorithm: "HS256" }
  );
}

export function readPasswordResetToken(token: string): { userId: number; version: string } {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });

    if (
      typeof payload === "string" ||
      payload.purpose !== PASSWORD_RESET_PURPOSE ||
      !Number.isSafeInteger(payload.userId) ||
      payload.userId <= 0 ||
      typeof payload.version !== "string" ||
      !/^[a-f0-9]{64}$/.test(payload.version)
    ) {
      throw new Error("Invalid password reset token payload");
    }

    return { userId: payload.userId, version: payload.version };
  } catch {
    throw new AppError("O link de redefinição é inválido ou expirou. Solicite uma nova recuperação de senha.", 400);
  }
}
