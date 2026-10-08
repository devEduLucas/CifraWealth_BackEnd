import type { DetailedReportResponse } from "../types/report.types.js";

const DAY = 86400000;
export function previousReportRange(start: string, end: string): { start: string; end: string } {
  const startTime = new Date(start + "T00:00:00Z").getTime();
  const days = (new Date(end + "T00:00:00Z").getTime() - startTime) / DAY + 1;
  return { start: new Date(startTime - days * DAY).toISOString().slice(0, 10), end: new Date(startTime - DAY).toISOString().slice(0, 10) };
}
export interface ReportTransaction {
  id: number; data: string; descricao: string; categoriaId: number; categoria: string; cor: string | null;
  tipo: "receita" | "despesa"; valor: number;
}
function round(value: number): number { return Math.round(value * 100) / 100; }
function variation(current: number, previous: number): number | null { return previous === 0 ? null : round((current - previous) / Math.abs(previous) * 100); }
function totals(items: ReportTransaction[]) {
  let incomeCents = 0;
  let expenseCents = 0;
  for (const item of items) {
    if (item.tipo === "receita") incomeCents += Math.round(item.valor * 100);
    else expenseCents += Math.round(item.valor * 100);
  }
  return { receitas: incomeCents / 100, despesas: expenseCents / 100, saldo: (incomeCents - expenseCents) / 100, taxa: incomeCents === 0 ? 0 : round((incomeCents - expenseCents) / incomeCents * 100) };
}
export function buildDetailedReport(start: string, end: string, all: ReportTransaction[], goals: DetailedReportResponse["goals"]): DetailedReportResponse {
  const previousRange = previousReportRange(start, end);
  const selected = all.filter((item) => item.data >= start && item.data <= end);
  const previous = totals(all.filter((item) => item.data >= previousRange.start && item.data <= previousRange.end));
  const current = totals(selected);
  const months = new Map<string, ReportTransaction[]>();
  const cursor = new Date(start.slice(0, 7) + "-01T00:00:00Z");
  while (cursor.toISOString().slice(0, 7) <= end.slice(0, 7)) {
    months.set(cursor.toISOString().slice(0, 7), []);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  const categories = new Map<number, { nome: string; cor: string; cents: number }>();
  const palette = ["#2dd4bf", "#38bdf8", "#fbbf24", "#a78bfa", "#fb7185", "#fb923c"];
  for (const item of selected) {
    months.get(item.data.slice(0, 7))?.push(item);
    if (item.tipo !== "despesa") continue;
    const group = categories.get(item.categoriaId) ?? { nome: item.categoria, cor: item.cor && /^#[0-9a-f]{6}$/i.test(item.cor) ? item.cor : palette[categories.size % palette.length]!, cents: 0 };
    group.cents += Math.round(item.valor * 100);
    categories.set(item.categoriaId, group);
  }
  const monthly = [...months].map(([id, items]) => ({ id, ...totals(items), label: new Date(id + "-01T00:00:00Z").toLocaleDateString("pt-BR", { month: "short", year: "2-digit", timeZone: "UTC" }) }));
  const categoryBreakdown = [...categories].map(([id, group]) => ({ id, nome: group.nome, cor: group.cor, total: group.cents / 100, percentual: current.despesas === 0 ? 0 : group.cents / (current.despesas * 100) * 100 })).sort((a,b) => b.total - a.total);
  const insights: DetailedReportResponse["insights"] = [];
  if (selected.length === 0) insights.push({ id: "empty", tipo: "neutro", mensagem: "Nenhuma transação confirmada no período selecionado." });
  else {
    insights.push({ id: "balance", tipo: current.saldo >= 0 ? "positivo" : "negativo", mensagem: current.saldo >= 0 ? "As receitas cobrem as despesas neste período." : "As despesas superam as receitas neste período." });
    const largest = categoryBreakdown[0];
    if (largest) insights.push({ id: "category", tipo: "neutro", mensagem: largest.nome + " representa " + round(largest.percentual) + "% das despesas." });
    const expenseChange = variation(current.despesas, previous.despesas);
    if (expenseChange !== null) insights.push({ id: "expenses", tipo: expenseChange <= 0 ? "positivo" : "negativo", mensagem: "As despesas " + (expenseChange <= 0 ? "caíram " : "aumentaram ") + Math.abs(expenseChange) + "% em relação ao período anterior de mesma duração." });
  }
  return {
    dataInicio: start, dataFim: end,
    summary: { receitas: current.receitas, despesas: current.despesas, saldo: current.saldo, taxaEconomiaPercentual: current.taxa, variacaoReceitas: variation(current.receitas, previous.receitas), variacaoDespesas: variation(current.despesas, previous.despesas), variacaoSaldo: variation(current.saldo, previous.saldo), variacaoTaxaEconomia: variation(current.taxa, previous.taxa) },
    evolution: monthly.map((m) => ({ mes: m.label, receitas: m.receitas, despesas: m.despesas, saldo: m.saldo })),
    monthlyComparison: monthly.map((m) => ({ mes: m.label, receitas: m.receitas, despesas: m.despesas })),
    history: monthly.map((m, index) => ({ id: m.id, periodo: m.label, receitas: m.receitas, despesas: m.despesas, saldo: m.saldo, variacaoPercentual: index === 0 ? null : variation(m.saldo, monthly[index-1]!.saldo) })),
    categoryBreakdown, insights, goals,
    transactions: [...selected].sort((a,b) => b.data.localeCompare(a.data) || b.id - a.id).map(({ id, data, descricao, categoria, tipo, valor }) => ({ id, data, descricao, categoria, tipo, valor })),
  };
}
