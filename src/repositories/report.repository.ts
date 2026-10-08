import { prisma } from "../lib/prisma.js";
import type { transacoes } from "../generated/prisma/client.js";

export const reportRepository = {
  findConfirmedByUserAndRange(userId: number, start: Date, end: Date) {
    return prisma.transacoes.findMany({ where: { id_usuario: userId, status: "confirmada", data_transacao: { gte: start, lte: end } }, include: { categorias: true }, orderBy: [{ data_transacao: "asc" }, { id_transacao: "asc" }] });
  },
  findConfirmedByUserAndYear(userId: number, ano: number): Promise<transacoes[]> {
    const inicio = new Date(`${ano}-01-01T00:00:00.000Z`);
    const fim = new Date(`${ano}-12-31T23:59:59.999Z`);

    return prisma.transacoes.findMany({
      where: {
        id_usuario: userId,
        status: "confirmada",
        data_transacao: { gte: inicio, lte: fim },
      },
      orderBy: { data_transacao: "asc" },
    });
  },
};
