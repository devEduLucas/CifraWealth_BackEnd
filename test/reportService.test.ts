import { test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "../src/generated/prisma/client.js";
import { reportService } from "../src/services/report.service.js";
import { reportRepository } from "../src/repositories/report.repository.js";
import { financialGoalRepository } from "../src/repositories/financialGoal.repository.js";

function transaction(id: number, date: string, amount: number, type: "receita" | "despesa" = "receita") {
  return {
    id_transacao: id, id_usuario: 17, id_categoria: 3,
    valor: new Prisma.Decimal(amount), tipo: type, descricao: "Teste de período",
    data_transacao: new Date(`${date}T00:00:00Z`), status: "confirmada" as const,
    created_at: null, updated_at: null,
    categorias: { id_categoria: 3, id_usuario: 17, nome: "Categoria", tipo: type, icone: null, cor: null, created_at: null, updated_at: null },
  };
}

test("relatório limita movimentos a hoje sem alterar o período solicitado e sua comparação", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T15:00:00Z") });
  const records = [transaction(1, "2026-10-02", 50), transaction(2, "2026-11-25", 100.01), transaction(3, "2026-11-26", 999)];
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndRange", async (userId: number, start: Date, end: Date) => {
    assert.equal(userId, 17);
    return records.filter((record) => record.data_transacao >= start && record.data_transacao <= end);
  });
  t.mock.method(financialGoalRepository, "findAllByUser", async () => []);
  const report = await reportService.detailed(17, { data_inicio: "2026-11-01", data_fim: "2026-11-30" });
  assert.equal(query.mock.calls[0]!.arguments[1].toISOString().slice(0, 10), "2026-10-02");
  assert.equal(query.mock.calls[0]!.arguments[2].toISOString().slice(0, 10), "2026-11-25");
  assert.equal(report.dataInicio, "2026-11-01");
  assert.equal(report.dataFim, "2026-11-30");
  assert.equal(report.summary.receitas, 100.01);
  assert.equal(report.summary.variacaoReceitas, 100.02);
  assert.deepEqual(report.transactions.map((record) => record.id), [2]);
});

test("período passado preserva o limite inclusivo e os centavos", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T15:00:00Z") });
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndRange", async () => [transaction(1, "2026-10-31", 0.1), transaction(2, "2026-10-31", 0.2)]);
  t.mock.method(financialGoalRepository, "findAllByUser", async () => []);
  const report = await reportService.detailed(17, { data_inicio: "2026-10-01", data_fim: "2026-10-31" });
  assert.equal(query.mock.calls[0]!.arguments[2]!.toISOString().slice(0, 10), "2026-10-31");
  assert.equal(report.summary.receitas, 0.3);
});

test("período inteiramente futuro fica vazio e preserva comparação já realizada", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T15:00:00Z") });
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndRange", async () => [transaction(1, "2026-11-25", 20)]);
  t.mock.method(financialGoalRepository, "findAllByUser", async () => []);
  const report = await reportService.detailed(17, { data_inicio: "2026-11-26", data_fim: "2026-11-27" });
  assert.equal(query.mock.calls[0]!.arguments[1]!.toISOString().slice(0, 10), "2026-11-24");
  assert.equal(query.mock.calls[0]!.arguments[2]!.toISOString().slice(0, 10), "2026-11-25");
  assert.equal(report.summary.receitas, 0);
  assert.equal(report.summary.variacaoReceitas, -100);
  assert.equal(report.transactions.length, 0);
  assert.equal(report.evolution.length, 1);
});

test("período e comparação totalmente futuros não consultam transações", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T15:00:00Z") });
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndRange", async () => []);
  t.mock.method(financialGoalRepository, "findAllByUser", async () => []);
  const report = await reportService.detailed(17, { data_inicio: "2027-02-01", data_fim: "2027-02-28" });
  assert.equal(query.mock.callCount(), 0);
  assert.equal(report.summary.saldo, 0);
  assert.equal(report.summary.variacaoReceitas, null);
  assert.equal(report.dataFim, "2027-02-28");
});

test("relatório mensal corta hoje ou o fim passado e mantém doze meses", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-26T01:00:00Z") });
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndYear", async () => [transaction(1, "2026-11-25", 0.3)]);
  const defaultReport = await reportService.monthly(17, 2026);
  assert.equal(query.mock.calls[0]!.arguments[2]!.toISOString().slice(0, 10), "2026-11-25", "O corte segue America/Sao_Paulo, não UTC.");
  assert.equal(defaultReport.length, 12);
  assert.equal(defaultReport[10]!.saldo, 0.3);
  await reportService.monthly(17, 2026, "2026-12-31");
  assert.equal(query.mock.calls[1]!.arguments[2]!.toISOString().slice(0, 10), "2026-11-25");
  await reportService.monthly(17, 2026, "2026-10-31");
  assert.equal(query.mock.calls[2]!.arguments[2]!.toISOString().slice(0, 10), "2026-10-31");
});

test("ano futuro ou corte anterior ao ano retorna meses vazios sem consultar transações", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: new Date("2026-11-25T15:00:00Z") });
  const query = t.mock.method(reportRepository, "findConfirmedByUserAndYear", async () => []);
  for (const report of [await reportService.monthly(17, 2027), await reportService.monthly(17, 2026, "2025-12-31")]) {
    assert.equal(report.length, 12);
    assert.ok(report.every((month) => month.saldo === 0 && month.total_receitas === 0 && month.total_despesas === 0));
  }
  assert.equal(query.mock.callCount(), 0);
});
