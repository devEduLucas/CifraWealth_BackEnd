import jwt from "jsonwebtoken";
import { randomBytes, timingSafeEqual } from "node:crypto";
import { jwtConfig } from "../config/jwt.js";
import { sessionVersion } from "./jwt.js";
import { AppError } from "./AppError.js";

type Credentials = Parameters<typeof sessionVersion>[0];

export function createAccountDeletionChallenge(user: Credentials) {
  const nonce = randomBytes(32).toString("base64url");
  const challengeToken = jwt.sign(
    {
      purpose: "delete-account",
      userId: user.id_usuario,
      version: sessionVersion(user),
      nonce,
    },
    jwtConfig.secret,
    { algorithm: "HS256", expiresIn: "5m" },
  );
  return { nonce, challengeToken };
}

export function readAccountDeletionChallenge(
  token: string,
  user: Credentials,
): string {
  try {
    const payload = jwt.verify(token, jwtConfig.secret, {
      algorithms: ["HS256"],
    });
    if (
      typeof payload === "string" ||
      payload.purpose !== "delete-account" ||
      payload.userId !== user.id_usuario ||
      typeof payload.nonce !== "string" ||
      !/^[A-Za-z0-9_-]{43}$/.test(payload.nonce) ||
      typeof payload.version !== "string"
    )
      throw new Error("Invalid challenge");
    const expected = Buffer.from(sessionVersion(user));
    const supplied = Buffer.from(payload.version);
    if (
      expected.length !== supplied.length ||
      !timingSafeEqual(expected, supplied)
    )
      throw new Error("Credentials changed");
    return payload.nonce;
  } catch {
    throw new AppError(
      "A confirmação expirou. Feche esta janela e tente novamente.",
      403,
    );
  }
}
