import { categoryRepository } from "../repositories/category.repository.js";
import { dashboardRepository } from "../repositories/dashboard.repository.js";
import type { DashboardFilters } from "../repositories/dashboard.repository.js";
import { parseDateOnly, todayDateOnly } from "../utils/formatDate.js";
import { toMoneyNumber } from "../utils/money.js";
import type { DashboardQuery, DashboardResponse } from "../types/dashboard.types.js";

export const dashboardService = {
  async getSummary(userId: number, query: DashboardQuery): Promise<DashboardResponse> {
    const today = todayDateOnly();
    const filters: DashboardFilters = {
      ...(query.data_inicio !== undefined && { data_inicio: parseDateOnly(query.data_inicio) }),
      data_fim: parseDateOnly(query.data_fim && query.data_fim < today ? query.data_fim : today),
    };

    const [totals, breakdown, categories] = await Promise.all([
      dashboardRepository.sumByTipo(userId, filters),
      dashboardRepository.sumByCategoria(userId, filters),
      categoryRepository.findAllByUser(userId),
    ]);

    const categoriesById = new Map(categories.map((category) => [category.id_categoria, category]));
    const total_receitas = toMoneyNumber(totals.receitas);
    const total_despesas = toMoneyNumber(totals.despesas);

    const por_categoria = breakdown
      .map((item) => {
        const category = categoriesById.get(item.id_categoria);
        if (!category) return null;
        return {
          id_categoria: item.id_categoria,
          nome: category.nome,
          tipo: category.tipo as "receita" | "despesa",
          total: toMoneyNumber(item.total),
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    return {
      saldo: (Math.round(total_receitas * 100) - Math.round(total_despesas * 100)) / 100,
      total_receitas,
      total_despesas,
      por_categoria,
    };
  },
};
