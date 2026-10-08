import { prisma } from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import type { metas_financeiras } from "../generated/prisma/client.js";
import { AppError } from "../utils/AppError.js";

// Every balance/target change takes the same row lock. Concurrent deposits cannot overwrite each other.
async function changeLocked(id: number, userId: number, change: (current: metas_financeiras) => Prisma.metas_financeirasUpdateInput): Promise<metas_financeiras> {
  return prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<Array<{ id_meta: number }>>
      `SELECT id_meta FROM metas_financeiras WHERE id_meta = ${id} AND id_usuario = ${userId} FOR UPDATE`;
    if (rows.length === 0) throw new AppError("Meta financeira não encontrada.", 404);
    const current = await tx.metas_financeiras.findUniqueOrThrow({ where: { id_meta: id } });
    return tx.metas_financeiras.update({ where: { id_meta: id, id_usuario: userId }, data: change(current) });
  });
}

export const financialGoalRepository = {
  findAllByUser(userId: number): Promise<metas_financeiras[]> {
    return prisma.metas_financeiras.findMany({ where: { id_usuario: userId }, orderBy: { created_at: "desc" } });
  },
  findByIdAndUser(id: number, userId: number): Promise<metas_financeiras | null> {
    return prisma.metas_financeiras.findFirst({ where: { id_meta: id, id_usuario: userId } });
  },
  create(userId: number, data: { titulo: string; descricao?: string | null; valor_objetivo: Prisma.Decimal; data_inicio?: Date | null; data_fim?: Date | null }): Promise<metas_financeiras> {
    return prisma.metas_financeiras.create({ data: { ...data, id_usuario: userId } });
  },
  update(id: number, userId: number, data: { titulo?: string; descricao?: string | null; valor_objetivo?: Prisma.Decimal; status?: "em_andamento" | "concluida" | "cancelada"; data_inicio?: Date | null; data_fim?: Date | null }): Promise<metas_financeiras> {
    return changeLocked(id, userId, (current) => {
      const start = data.data_inicio === undefined ? current.data_inicio : data.data_inicio;
      const end = data.data_fim === undefined ? current.data_fim : data.data_fim;
      if (start && end && start > end) throw new AppError("Prazo deve ser igual ou posterior à data de início.", 400);
      const target = data.valor_objetivo ?? current.valor_objetivo;
      const reached = (current.valor_atual ?? new Prisma.Decimal(0)).gte(target);
      const requestedStatus = data.status ?? current.status ?? "em_andamento";
      if (data.status === "concluida" && !reached) throw new AppError("Registre o valor guardado antes de concluir a meta.", 400);
      const status = requestedStatus === "cancelada" ? "cancelada" : reached ? "concluida" : "em_andamento";
      return { ...data, status };
    });
  },
  contribute(id: number, userId: number, amount: Prisma.Decimal): Promise<metas_financeiras> {
    return changeLocked(id, userId, (current) => {
      if (current.status === "cancelada") throw new AppError("Metas canceladas não recebem novos valores.", 400);
      const value = (current.valor_atual ?? new Prisma.Decimal(0)).plus(amount);
      if (value.gt("99999999.99")) throw new AppError("O valor acumulado excede o limite permitido.", 400);
      return { valor_atual: value, status: value.gte(current.valor_objetivo) ? "concluida" : "em_andamento" };
    });
  },
  delete(id: number, userId: number): Promise<metas_financeiras> {
    return prisma.metas_financeiras.delete({ where: { id_meta: id, id_usuario: userId } });
  },
};
