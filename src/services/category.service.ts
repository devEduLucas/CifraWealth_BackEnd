import { categoryRepository } from "../repositories/category.repository.js";
import { AppError } from "../utils/AppError.js";
import type { categorias } from "../generated/prisma/client.js";
import type { CategoryResponse, CreateCategoryInput, UpdateCategoryInput } from "../types/category.types.js";

function toCategoryResponse(category: categorias, userId: number): CategoryResponse & { editavel: boolean } {
  return { id_categoria: category.id_categoria, nome: category.nome, tipo: category.tipo, icone: category.icone, cor: category.cor, editavel: category.id_usuario === userId };
}
async function accessible(id: number, userId: number): Promise<categorias> {
  const category = await categoryRepository.findById(id, userId);
  if (!category) throw new AppError("Categoria não encontrada.", 404);
  return category;
}
async function owned(id: number, userId: number): Promise<categorias> {
  const category = await accessible(id, userId);
  if (category.id_usuario !== userId) throw new AppError("Categorias compartilhadas são somente leitura.", 403);
  return category;
}
export const categoryService = {
  async list(userId: number) { return (await categoryRepository.findAll(userId)).map((item) => toCategoryResponse(item, userId)); },
  async getById(id: number, userId: number) { return toCategoryResponse(await accessible(id, userId), userId); },
  async create(userId: number, input: CreateCategoryInput) { return toCategoryResponse(await categoryRepository.create(userId, input), userId); },
  async update(id: number, userId: number, input: UpdateCategoryInput) {
    const category = await owned(id, userId);
    if (input.tipo && input.tipo !== category.tipo && await categoryRepository.countTransactions(id) > 0) throw new AppError("Não altere o tipo de uma categoria que possui transações.", 409);
    return toCategoryResponse(await categoryRepository.update(id, userId, input), userId);
  },
  async remove(id: number, userId: number): Promise<void> {
    await owned(id, userId);
    if (await categoryRepository.countTransactions(id) > 0) throw new AppError("Categoria possui transações. Remova ou recategorize as transações antes de excluí-la.", 409);
    await categoryRepository.delete(id, userId);
  },
};
