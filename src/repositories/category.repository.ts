import { prisma } from "../lib/prisma.js";
import type { categorias } from "../generated/prisma/client.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "../types/category.types.js";

export const categoryRepository = {
  findAllByUser(userId: number): Promise<categorias[]> {
    return prisma.categorias.findMany({
      where: { id_usuario: userId },
      orderBy: { nome: "asc" },
    });
  },

  findByIdAndUser(id: number, userId: number): Promise<categorias | null> {
    return prisma.categorias.findFirst({ where: { id_categoria: id, id_usuario: userId } });
  },

  findByNameAndType(
    userId: number,
    nome: string,
    tipo: "receita" | "despesa"
  ): Promise<categorias | null> {
    return prisma.categorias.findFirst({ where: { id_usuario: userId, nome, tipo } });
  },

  countTransactions(id: number): Promise<number> {
    return prisma.transacoes.count({ where: { id_categoria: id } });
  },

  create(userId: number, data: CreateCategoryInput): Promise<categorias> {
    return prisma.categorias.create({
      data: {
        id_usuario: userId,
        nome: data.nome,
        tipo: data.tipo,
        icone: data.icone ?? null,
        cor: data.cor ?? null,
      },
    });
  },

  update(id: number, userId: number, data: UpdateCategoryInput): Promise<categorias> {
    return prisma.categorias.update({
      where: { id_categoria: id, id_usuario: userId },
      data: {
        ...(data.nome !== undefined && { nome: data.nome }),
        ...(data.tipo !== undefined && { tipo: data.tipo }),
        ...(data.icone !== undefined && { icone: data.icone }),
        ...(data.cor !== undefined && { cor: data.cor }),
      },
    });
  },

  delete(id: number, userId: number): Promise<categorias> {
    return prisma.categorias.delete({ where: { id_categoria: id, id_usuario: userId } });
  },
};
