import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { matchesSessionVersion, verifyToken, type TokenPayload } from "../utils/jwt.js";
import { userRepository } from "../repositories/user.repository.js";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
    }
  }
}

export async function authMiddleware(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    next(new AppError("Token de acesso não informado.", 401));
    return;
  }

  const token = authHeader.slice("Bearer ".length);

  let payload: TokenPayload;
  try {
    payload = verifyToken(token);
  } catch {
    next(new AppError("Token de acesso inválido ou expirado.", 401));
    return;
  }

  try {
    const user = await userRepository.findById(payload.userId);
    if (!user || user.email_verificado !== true) {
      next(new AppError("Usuário não encontrado ou inativo.", 401));
      return;
    }
    if (!matchesSessionVersion(payload.credentialVersion, user)) {
      next(new AppError("Sua sessão expirou. Faça login novamente.", 401));
      return;
    }
    req.userId = payload.userId;
    next();
  } catch (error) {
    // A repository outage must not invalidate an otherwise valid session.
    next(error);
  }
}
