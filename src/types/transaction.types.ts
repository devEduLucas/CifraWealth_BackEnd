import { z } from "zod";
import { dateOnlySchema, datesInOrder, moneySchema } from "../utils/validationSchemas.js";

export const transactionTypeSchema = z.enum(["receita", "despesa"]);
export const transactionStatusSchema = z.enum(["confirmada", "pendente"]);



export const createTransactionSchema = z.object({
  id_categoria: z.number().int().positive(),
  valor: moneySchema,
  tipo: transactionTypeSchema,
  descricao: z.string().trim().min(1, "Descrição é obrigatória.").max(200),
  data_transacao: dateOnlySchema,
  status: transactionStatusSchema.optional(),
});

export type CreateTransactionInput = z.infer<typeof createTransactionSchema>;

export const updateTransactionSchema = createTransactionSchema.partial();

export type UpdateTransactionInput = z.infer<typeof updateTransactionSchema>;

export const listTransactionsQuerySchema = z.object({
  tipo: transactionTypeSchema.optional(),
  id_categoria: z.coerce.number().int().positive().optional(),
  data_inicio: dateOnlySchema.optional(),
  data_fim: dateOnlySchema.optional(),
}).refine(datesInOrder, "Data inicial deve ser igual ou anterior à data final.");

export type ListTransactionsQuery = z.infer<typeof listTransactionsQuerySchema>;

export interface TransactionResponse {
  id_transacao: number;
  id_categoria: number;
  valor: number;
  tipo: "receita" | "despesa";
  descricao: string;
  data_transacao: string;
  status: "confirmada" | "pendente";
}
