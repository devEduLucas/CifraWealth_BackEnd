import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.js";
import { createHmac, timingSafeEqual } from "node:crypto";

const ACCESS_TOKEN_PURPOSE = "access";

export interface TokenPayload {
  userId: number;
  credentialVersion: string;
}

interface SessionCredentials {
  id_usuario: number;
  email: string;
  senha: string | null;
  google_id: string | null;
}

export function sessionVersion(user: SessionCredentials): string {
  return createHmac("sha256", jwtConfig.secret)
    .update("access-session\0")
    .update(JSON.stringify([user.id_usuario, user.email, user.senha, user.google_id]))
    .digest("hex");
}

export function matchesSessionVersion(version: string, user: SessionCredentials): boolean {
  const expected = Buffer.from(sessionVersion(user), "hex");
  const supplied = Buffer.from(version, "hex");
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign({ ...payload, purpose: ACCESS_TOKEN_PURPOSE }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
    algorithm: "HS256",
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, jwtConfig.secret, { algorithms: ["HS256"] });

  if (
    typeof payload === "string" ||
    payload.purpose !== ACCESS_TOKEN_PURPOSE ||
    !Number.isSafeInteger(payload.userId) || payload.userId <= 0 ||
    typeof payload.credentialVersion !== "string" || !/^[a-f0-9]{64}$/.test(payload.credentialVersion)
  ) {
    throw new Error("Invalid token payload or purpose");
  }

  return payload as TokenPayload;
}
