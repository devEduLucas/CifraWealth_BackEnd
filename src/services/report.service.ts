import { reportRepository } from "../repositories/report.repository.js";
import { toMoneyNumber } from "../utils/money.js";
import type { MonthlyReportItem } from "../types/report.types.js";

export const reportService = {
  async monthly(userId: number, ano: number): Promise<MonthlyReportItem[]> {
    const transactions = await reportRepository.findConfirmedByUserAndYear(userId, ano);

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
