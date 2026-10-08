import { categoryRepository } from "../repositories/category.repository.js";
import { transactionRepository } from "../repositories/transaction.repository.js";
import type { TransactionFilters } from "../repositories/transaction.repository.js";
import { AppError } from "../utils/AppError.js";
import { parseDateOnly, toDateOnlyString } from "../utils/formatDate.js";
import { toDecimal, toMoneyNumber } from "../utils/money.js";
import type {
  CreateTransactionInput,
  ListTransactionsQuery,
  TransactionResponse,
  UpdateTransactionInput,
} from "../types/transaction.types.js";

function toTransactionResponse(transaction: {
  id_transacao: number;
  id_categoria: number;
  valor: unknown;
  tipo: string;
  descricao: string;
  data_transacao: Date;
  status: string | null;
}): TransactionResponse {
  return {
    id_transacao: transaction.id_transacao,
    id_categoria: transaction.id_categoria,
    valor: toMoneyNumber(transaction.valor as never),
    tipo: transaction.tipo as TransactionResponse["tipo"],
    descricao: transaction.descricao,
    data_transacao: toDateOnlyString(transaction.data_transacao),
    status: (transaction.status ?? "confirmada") as TransactionResponse["status"],
  };
}

async function ensureCategoryExists(id_categoria: number, userId: number): Promise<void> {
  const category = await categoryRepository.findByIdAndUser(id_categoria, userId);

  if (!category) {
    throw new AppError("Categoria não encontrada.", 404);
  }
}

export const transactionService = {
  async list(userId: number, query: ListTransactionsQuery): Promise<TransactionResponse[]> {
    const filters: TransactionFilters = {
      ...(query.tipo !== undefined && { tipo: query.tipo }),
      ...(query.id_categoria !== undefined && { id_categoria: query.id_categoria }),
      ...(query.data_inicio !== undefined && { data_inicio: parseDateOnly(query.data_inicio) }),
      ...(query.data_fim !== undefined && { data_fim: parseDateOnly(query.data_fim) }),
    };

    const transactions = await transactionRepository.findAllByUser(userId, filters);
    return transactions.map(toTransactionResponse);
  },

  async getById(id: number, userId: number): Promise<TransactionResponse> {
    const transaction = await transactionRepository.findByIdAndUser(id, userId);

    if (!transaction) {
      throw new AppError("Transação não encontrada.", 404);
    }

    return toTransactionResponse(transaction);
  },

  async create(userId: number, input: CreateTransactionInput): Promise<TransactionResponse> {
    await ensureCategoryExists(input.id_categoria, userId);

    const transaction = await transactionRepository.create(userId, {
      id_categoria: input.id_categoria,
      valor: toDecimal(input.valor),
      tipo: input.tipo,
      descricao: input.descricao,
      data_transacao: parseDateOnly(input.data_transacao),
      ...(input.status !== undefined && { status: input.status }),
    });

    return toTransactionResponse(transaction);
  },

  async update(
    id: number,
    userId: number,
    input: UpdateTransactionInput
  ): Promise<TransactionResponse> {
    await transactionService.getById(id, userId);

    if (input.id_categoria !== undefined) {
      await ensureCategoryExists(input.id_categoria, userId);
    }

    const transaction = await transactionRepository.update(id, {
      ...(input.id_categoria !== undefined && { id_categoria: input.id_categoria }),
      ...(input.valor !== undefined && { valor: toDecimal(input.valor) }),
      ...(input.tipo !== undefined && { tipo: input.tipo }),
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      ...(input.data_transacao !== undefined && {
        data_transacao: parseDateOnly(input.data_transacao),
      }),
      ...(input.status !== undefined && { status: input.status }),
    });

    return toTransactionResponse(transaction);
  },

  async remove(id: number, userId: number): Promise<void> {
    await transactionService.getById(id, userId);
    await transactionRepository.delete(id);
  },
};
