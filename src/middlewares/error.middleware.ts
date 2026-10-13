import type { NextFunction, Request, Response } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { ZodError } from "zod";
import { AppError } from "../utils/AppError.js";

interface HttpErrorLike {
  status?: number;
  statusCode?: number;
  type?: string;
}

export function errorMiddleware(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Body-parser SyntaxError / Invalid JSON
  if (
    typeof err === "object" &&
    err !== null &&
    ("type" in err && (err as HttpErrorLike).type === "entity.parse.failed" ||
      "status" in err && (err as HttpErrorLike).status === 400)
  ) {
    res.status(400).json({ message: "Corpo da requisição contém JSON inválido ou malformado." });
    return;
  }

  // Payload too large
  if (
    typeof err === "object" &&
    err !== null &&
    ("type" in err && (err as HttpErrorLike).type === "entity.too.large" ||
      "status" in err && (err as HttpErrorLike).status === 413)
  ) {
    res.status(413).json({ message: "O tamanho da requisição excede o limite permitido." });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({ message: err.issues.map((issue) => issue.message).join(", ") });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ message: err.message });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ message: "Registro já existe." });
      return;
    }
    if (err.code === "P2003") {
      const isDelete = req.method === "DELETE";
      res.status(isDelete ? 409 : 400).json({
        message: isDelete
          ? "Registro possui vínculos com outros dados e não pode ser excluído."
          : "Registro relacionado não foi encontrado ou não existe.",
      });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ message: "Registro não encontrado." });
      return;
    }
  }

  console.error(err);
  res.status(500).json({ message: "Erro interno do servidor." });
}
