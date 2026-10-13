import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AppError } from "./AppError.js";

const EMAIL_VERIFICATION_PURPOSE = "email-verification";

export function createEmailVerificationToken(userId: number): string {
  return jwt.sign(
    { userId, purpose: EMAIL_VERIFICATION_PURPOSE },
    env.EMAIL_VERIFICATION_SECRET!,
    { expiresIn: "24h" }
  );
}

export function readEmailVerificationToken(token: string): number {
  try {
    const payload = jwt.verify(token, env.EMAIL_VERIFICATION_SECRET!);

    if (
      typeof payload === "string" ||
      payload.purpose !== EMAIL_VERIFICATION_PURPOSE ||
      typeof payload.userId !== "number"
    ) {
      throw new Error("Invalid email verification token payload");
    }

    return payload.userId;
  } catch {
    throw new AppError("O link de confirmação é inválido ou expirou. Solicite um novo e-mail de confirmação.", 400);
  }
}
