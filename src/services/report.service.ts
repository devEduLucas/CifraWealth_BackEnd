import { financialGoalRepository } from "../repositories/financialGoal.repository.js";
import { buildDetailedReport, previousReportRange } from "../utils/reports.js";
import { parseDateOnly, toDateOnlyString, todayDateOnly } from "../utils/formatDate.js";
import type { DetailedReportQuery, DetailedReportResponse } from "../types/report.types.js";
import { reportRepository } from "../repositories/report.repository.js";
import { toMoneyNumber } from "../utils/money.js";
import type { MonthlyReportItem } from "../types/report.types.js";

export const reportService = {
  async detailed(userId: number, query: DetailedReportQuery): Promise<DetailedReportResponse> {
    const previous = previousReportRange(query.data_inicio, query.data_fim);
    // Keep the requested period and comparison, but only query realized movements.
    const today = todayDateOnly();
    const cutoff = query.data_fim < today ? query.data_fim : today;
    const [transactions, goals] = await Promise.all([
      previous.start > cutoff
        ? []
        : reportRepository.findConfirmedByUserAndRange(userId, parseDateOnly(previous.start), parseDateOnly(cutoff)),
      financialGoalRepository.findAllByUser(userId),
    ]);
    return buildDetailedReport(query.data_inicio, query.data_fim, transactions.map((item) => ({ id: item.id_transacao, data: toDateOnlyString(item.data_transacao), descricao: item.descricao, categoriaId: item.id_categoria, categoria: item.categorias.nome, cor: item.categorias.cor, tipo: item.tipo, valor: toMoneyNumber(item.valor) })), goals.filter((goal) => goal.status !== "cancelada").map((goal) => ({ id: goal.id_meta, nome: goal.titulo, valorAtual: toMoneyNumber(goal.valor_atual), valorAlvo: toMoneyNumber(goal.valor_objetivo) })));
  },
  async monthly(userId: number, ano: number, end?: string): Promise<MonthlyReportItem[]> {
    const today = todayDateOnly();
    const cutoff = end && end < today ? end : today;
    const transactions = cutoff < `${ano}-01-01`
      ? []
      : await reportRepository.findConfirmedByUserAndYear(userId, ano, parseDateOnly(cutoff));

    const totalsByMonth = new Map<string, { receitas: number; despesas: number }>();

    for (let mes = 1; mes <= 12; mes += 1) {
      const chave = `${ano}-${String(mes).padStart(2, "0")}`;
      totalsByMonth.set(chave, { receitas: 0, despesas: 0 });
    }

    for (const transaction of transactions) {
      const chave = transaction.data_transacao.toISOString().slice(0, 7);
      const acumulado = totalsByMonth.get(chave);

      if (!acumulado) continue;

      const valor = toMoneyNumber(transaction.valor as never);

      if (transaction.tipo === "receita") {
        acumulado.receitas += Math.round(valor * 100);
      } else {
        acumulado.despesas += Math.round(valor * 100);
      }
    }

    return Array.from(totalsByMonth.entries()).map(([mes, totals]) => ({
      mes,
      total_receitas: totals.receitas / 100,
      total_despesas: totals.despesas / 100,
      saldo: (totals.receitas - totals.despesas) / 100,
    }));
  },
};
