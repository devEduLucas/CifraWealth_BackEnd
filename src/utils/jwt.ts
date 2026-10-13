import jwt from "jsonwebtoken";
import { jwtConfig } from "../config/jwt.js";

const ACCESS_TOKEN_PURPOSE = "access";

export interface TokenPayload {
  userId: number;
  purpose?: string;
}

export function signToken(payload: Omit<TokenPayload, "purpose">): string {
  return jwt.sign({ ...payload, purpose: ACCESS_TOKEN_PURPOSE }, jwtConfig.secret, {
    expiresIn: jwtConfig.expiresIn,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  const payload = jwt.verify(token, jwtConfig.secret);

  if (
    typeof payload === "string" ||
    payload.purpose !== ACCESS_TOKEN_PURPOSE ||
    typeof payload.userId !== "number"
  ) {
    throw new Error("Invalid token payload or purpose");
  }

  return payload as TokenPayload;
}
