import { prisma } from "../lib/prisma.js";
import type { categorias } from "../generated/prisma/client.js";
import type { CreateCategoryInput, UpdateCategoryInput } from "../types/category.types.js";

export const categoryRepository = {
  findAll(userId: number): Promise<categorias[]> {
    return prisma.categorias.findMany({ where: { OR: [{ id_usuario: null }, { id_usuario: userId }] }, orderBy: { nome: "asc" } });
  },
  findById(id: number, userId: number): Promise<categorias | null> {
    return prisma.categorias.findFirst({ where: { id_categoria: id, OR: [{ id_usuario: null }, { id_usuario: userId }] } });
  },
  create(userId: number, data: CreateCategoryInput): Promise<categorias> {
    return prisma.categorias.create({ data: { nome: data.nome, tipo: data.tipo, icone: data.icone ?? null, cor: data.cor ?? null, id_usuario: userId } });
  },
  update(id: number, userId: number, data: UpdateCategoryInput): Promise<categorias> {
    return prisma.categorias.update({ where: { id_categoria: id, id_usuario: userId }, data: { ...(data.nome !== undefined && { nome: data.nome }), ...(data.tipo !== undefined && { tipo: data.tipo }), ...(data.icone !== undefined && { icone: data.icone }), ...(data.cor !== undefined && { cor: data.cor }) } });
  },
  countTransactions(id: number): Promise<number> {
    return prisma.transacoes.count({ where: { id_categoria: id } });
  },
  delete(id: number, userId: number): Promise<categorias> {
    return prisma.categorias.delete({ where: { id_categoria: id, id_usuario: userId } });
  },
};
