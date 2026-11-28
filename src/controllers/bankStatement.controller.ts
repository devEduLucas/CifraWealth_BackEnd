import type { NextFunction, Request, Response } from "express";
import { categoryRepository } from "../repositories/category.repository.js";
import { prisma } from "../lib/prisma.js";
import { parseBankStatement, parseBankStatementPdf } from "../services/bankStatementParser.service.js";
import { AppError } from "../utils/AppError.js";

const MAX_FILE_BYTES = 2 * 1024 * 1024;
const BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export const bankStatementController = {
  async import(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.userId) throw new AppError("Não autenticado.", 401);

      const fileName = typeof req.body?.fileName === "string" ? req.body.fileName : "";
      if (!fileName) throw new AppError("Informe o nome do arquivo enviado.", 400);

      let parsed;
      const isPdf = fileName.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        const contentBase64 = typeof req.body?.contentBase64 === "string" ? req.body.contentBase64 : "";
        if (!contentBase64 || !BASE64_PATTERN.test(contentBase64)) {
          throw new AppError("O conteúdo do PDF está ausente ou inválido. Selecione o arquivo novamente.", 400);
        }

        const pdfBuffer = Buffer.from(contentBase64, "base64");
        if (pdfBuffer.length > MAX_FILE_BYTES) {
          throw new AppError("O arquivo excede o limite de 2 MB.", 413);
        }
        if (pdfBuffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
          throw new AppError("O arquivo selecionado não é um PDF válido.", 400);
        }

        parsed = await parseBankStatementPdf(pdfBuffer);
      } else {
        const content = typeof req.body?.content === "string" ? req.body.content : "";
        if (!content) throw new AppError("Envie o conteúdo do arquivo OFX ou CSV.", 400);
        if (Buffer.byteLength(content, "utf8") > MAX_FILE_BYTES) {
          throw new AppError("O arquivo excede o limite de 2 MB.", 413);
        }

        parsed = parseBankStatement(fileName, content);
      }

      const incomeCategory = await categoryRepository.findByNameAndType(req.userId, "Importação bancária", "receita")
        ?? await categoryRepository.create(req.userId, { nome: "Importação bancária", tipo: "receita", icone: "landmark" });
      const expenseCategory = await categoryRepository.findByNameAndType(req.userId, "Importação bancária", "despesa")
        ?? await categoryRepository.create(req.userId, { nome: "Importação bancária", tipo: "despesa", icone: "landmark" });

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
