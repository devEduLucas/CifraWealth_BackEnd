import { z } from "zod";
import { dateOnlySchema, datesInOrder } from "../utils/validationSchemas.js";

export const dashboardQuerySchema = z
  .object({
    data_inicio: dateOnlySchema.optional(),
    data_fim: dateOnlySchema.optional(),
  })
  .refine(datesInOrder, "Data inicial deve ser igual ou anterior à data final.");

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>;

export interface CategoryBreakdownItem {
  id_categoria: number;
  nome: string;
  tipo: "receita" | "despesa";
  total: number;
}

export interface DashboardResponse {
  saldo: number;
  total_receitas: number;
  total_despesas: number;
  por_categoria: CategoryBreakdownItem[];
}