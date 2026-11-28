import type { NextFunction, Request, Response } from "express";
import { categoryRepository } from "../repositories/category.repository.js";
import { prisma } from "../lib/prisma.js";
import { parseBankStatement } from "../services/bankStatementParser.service.js";
import { AppError } from "../utils/AppError.js";

export const bankStatementController = {
  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) throw new AppError("Não autenticado.", 401);

      const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "";
      const content = typeof req.body?.content === "string" ? req.body.content : "";
      if (!fileName || !content) throw new AppError("Envie o nome e o conteúdo do arquivo OFX ou CSV.", 400);
      if (Buffer.byteLength(content, "utf8") > 2 * 1024 * 1024) {
        throw new AppError("O arquivo excede o limite de 2 MB.", 413);
      }

      const parsed = parseBankStatement(fileName, content);
      const categories = await categoryRepository.findAllByUser(req.userId);
      const incomeCategory = categories.find((category) => category.tipo === "receita");
      const expenseCategory = categories.find((category) => category.tipo === "despesa");

      if (!incomeCategory || !expenseCategory) {
        throw new AppError("Crie ao menos uma categoria de receita e uma de despesa antes de importar o extrato.", 400);
      }

      let imported = 0;
      let duplicates = 0;
      for (const item of parsed) {
        const categoryId = item.suggestedType === "receita" ? incomeCategory.id_categoria : expenseCategory.id_categoria;
        try {
          await prisma.transacoes.create({
            data: {
              id_usuario: req.userId,
              id_categoria: categoryId,
              valor: item.amount,
              tipo: item.suggestedType,
              descricao: item.description,
              data_transacao: new Date(`${item.date}T00:00:00.000Z`),
              status: "pendente",
              import_fingerprint: item.fingerprint,
            },
          });
          imported += 1;
        } catch (error) {
          if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
            duplicates += 1;
            continue;
          }
          throw error;
        }
      }

      res.status(200).json({
        message: "Extrato processado. As movimentações importadas ficaram pendentes de revisão.",
        total: parsed.length,
        imported,
        duplicates,
        pendingReview: imported,
      });
    } catch (error) {
      next(error);
    }
  },
};
