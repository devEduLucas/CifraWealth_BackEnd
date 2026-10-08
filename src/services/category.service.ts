import { categoryRepository } from "../repositories/category.repository.js";
import { AppError } from "../utils/AppError.js";
import type {
  CategoryResponse,
  CreateCategoryInput,
  UpdateCategoryInput,
} from "../types/category.types.js";

function toCategoryResponse(category: {
  id_categoria: number;
  nome: string;
  tipo: string;
  icone: string | null;
  cor: string | null;
}): CategoryResponse {
  return {
    id_categoria: category.id_categoria,
    nome: category.nome,
    tipo: category.tipo as CategoryResponse["tipo"],
    icone: category.icone,
    cor: category.cor,
  };
}

async function ensureNameAvailable(
  userId: number,
  nome: string,
  tipo: "receita" | "despesa",
  ignoreId?: number
): Promise<void> {
  const existing = await categoryRepository.findByNameAndType(userId, nome, tipo);

  if (existing && existing.id_categoria !== ignoreId) {
    throw new AppError("Você já possui uma categoria com esse nome.", 409);
  }
}

export const categoryService = {
  async list(userId: number): Promise<CategoryResponse[]> {
    const categories = await categoryRepository.findAllByUser(userId);
    return categories.map(toCategoryResponse);
  },

  async getById(id: number, userId: number): Promise<CategoryResponse> {
    const category = await categoryRepository.findByIdAndUser(id, userId);

    if (!category) {
      throw new AppError("Categoria não encontrada.", 404);
    }

    return toCategoryResponse(category);
  },

  async create(userId: number, input: CreateCategoryInput): Promise<CategoryResponse> {
    await ensureNameAvailable(userId, input.nome, input.tipo);

    const category = await categoryRepository.create(userId, input);
    return toCategoryResponse(category);
  },

  async update(
    id: number,
    userId: number,
    input: UpdateCategoryInput
  ): Promise<CategoryResponse> {
    const current = await categoryService.getById(id, userId);

    const nome = input.nome ?? current.nome;
    const tipo = input.tipo ?? current.tipo;

    if (input.tipo !== undefined && input.tipo !== current.tipo) {
      const transactionsCount = await categoryRepository.countTransactions(id);

      if (transactionsCount > 0) {
        throw new AppError(
          "Não é possível alterar o tipo de uma categoria que possui transações.",
          409
        );
      }
    }

    if (input.nome !== undefined || input.tipo !== undefined) {
      await ensureNameAvailable(userId, nome, tipo, id);
    }

    const category = await categoryRepository.update(id, input);
    return toCategoryResponse(category);
  },

  async remove(id: number, userId: number): Promise<void> {
    await categoryService.getById(id, userId);

    const transactionsCount = await categoryRepository.countTransactions(id);

    if (transactionsCount > 0) {
      throw new AppError(
        "Não é possível excluir uma categoria que possui transações. Altere ou exclua as transações primeiro.",
        409
      );
    }

    await categoryRepository.delete(id);
  },
};
