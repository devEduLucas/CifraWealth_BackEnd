import { prisma } from "../lib/prisma.js";
import type { transacoes } from "../generated/prisma/client.js";
import type { Prisma } from "../generated/prisma/client.js";

export interface TransactionFilters {
  tipo?: "receita" | "despesa";
  id_categoria?: number;
  data_inicio?: Date;
  data_fim?: Date;
}

function buildWhere(userId: number, filters: TransactionFilters): Prisma.transacoesWhereInput {
  return {
    id_usuario: userId,
    ...(filters.tipo !== undefined && { tipo: filters.tipo }),
    ...(filters.id_categoria !== undefined && { id_categoria: filters.id_categoria }),
    ...((filters.data_inicio !== undefined || filters.data_fim !== undefined) && {
      data_transacao: {
        ...(filters.data_inicio !== undefined && { gte: filters.data_inicio }),
        ...(filters.data_fim !== undefined && { lte: filters.data_fim }),
      },
    }),
  };
}

export const transactionRepository = {
  findAllByUser(userId: number, filters: TransactionFilters): Promise<transacoes[]> {
    return prisma.transacoes.findMany({
      where: buildWhere(userId, filters),
      orderBy: { data_transacao: "desc" },
    });
  },

  findByIdAndUser(id: number, userId: number): Promise<transacoes | null> {
    return prisma.transacoes.findFirst({ where: { id_transacao: id, id_usuario: userId } });
  },

  create(
    userId: number,
    data: {
      id_categoria: number;
      valor: Prisma.Decimal;
      tipo: "receita" | "despesa";
      descricao: string;
      data_transacao: Date;
      status?: "confirmada" | "pendente";
    }
  ): Promise<transacoes> {
    return prisma.transacoes.create({
      data: {
        id_usuario: userId,
        id_categoria: data.id_categoria,
        valor: data.valor,
        tipo: data.tipo,
        descricao: data.descricao,
        data_transacao: data.data_transacao,
        status: data.status ?? "confirmada",
      },
    });
  },

  update(
    id: number,
    userId: number,
    data: {
      id_categoria?: number;
      valor?: Prisma.Decimal;
      tipo?: "receita" | "despesa";
      descricao?: string;
      data_transacao?: Date;
      status?: "confirmada" | "pendente";
    }
  ): Promise<transacoes> {
    return prisma.transacoes.update({
      where: { id_transacao: id, id_usuario: userId },
      data: {
        ...(data.id_categoria !== undefined && { id_categoria: data.id_categoria }),
        ...(data.valor !== undefined && { valor: data.valor }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.descricao !== undefined && { descricao: data.descricao }),
        ...(data.data_transacao !== undefined && { data_transacao: data.data_transacao }),
        ...(data.status !== undefined && { status: data.status }),
      },
    });
  },

  delete(id: number, userId: number): Promise<transacoes> {
    return prisma.transacoes.delete({ where: { id_transacao: id, id_usuario: userId } });
  },
};
