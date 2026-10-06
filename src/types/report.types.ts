import { z } from "zod";
import { dateOnlySchema, datesInOrder } from "../utils/validationSchemas.js";

export const monthlyReportQuerySchema = z.object({ ano: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()) });
export const detailedReportQuerySchema = z.object({ data_inicio: dateOnlySchema, data_fim: dateOnlySchema })
  .refine(datesInOrder, "Data inicial deve ser igual ou anterior à data final.")
  .refine((value) => new Date(value.data_fim).getTime() - new Date(value.data_inicio).getTime() <= 366 * 5 * 86400000, "Selecione um período de até cinco anos.");
export type MonthlyReportQuery = z.infer<typeof monthlyReportQuerySchema>;
export type DetailedReportQuery = z.infer<typeof detailedReportQuerySchema>;
export interface MonthlyReportItem { mes: string; total_receitas: number; total_despesas: number; saldo: number }

export interface DetailedReportResponse {
  dataInicio: string;
  dataFim: string;
  summary: {
    receitas: number; despesas: number; saldo: number; taxaEconomiaPercentual: number;
    variacaoReceitas: number | null; variacaoDespesas: number | null; variacaoSaldo: number | null; variacaoTaxaEconomia: number | null;
  };
  evolution: Array<{ mes: string; receitas: number; despesas: number; saldo: number }>;
  categoryBreakdown: Array<{ id: number; nome: string; percentual: number; total: number; cor: string }>;
  monthlyComparison: Array<{ mes: string; receitas: number; despesas: number }>;
  insights: Array<{ id: string; tipo: "positivo" | "negativo" | "neutro"; mensagem: string }>;
  goals: Array<{ id: number; nome: string; valorAtual: number; valorAlvo: number }>;
  history: Array<{ id: string; periodo: string; receitas: number; despesas: number; saldo: number; variacaoPercentual: number | null }>;
  transactions: Array<{ id: number; data: string; descricao: string; categoria: string; tipo: "receita" | "despesa"; valor: number }>;
}
