import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDetailedReport, previousReportRange } from '../src/utils/reports.js';
import type { ReportTransaction } from '../src/utils/reports.js';
import { dateOnlySchema, moneySchema } from '../src/utils/validationSchemas.js';
import { detailedReportQuerySchema } from '../src/types/report.types.js';
import { createGoalSchema, updateGoalSchema } from '../src/types/financialGoal.types.js';
import { listTransactionsQuerySchema } from '../src/types/transaction.types.js';
function tx(id: number, data: string, valor: number, tipo: 'receita' | 'despesa' = 'receita'): ReportTransaction { return { id, data, valor, tipo, descricao: 'Teste', categoriaId: tipo === 'receita' ? 1 : 2, categoria: 'Categoria', cor: null }; }

test('datas reais, ano bissexto, intervalo invertido e limite de período', () => {
  assert.equal(dateOnlySchema.safeParse('2026-02-30').success, false);
  assert.equal(dateOnlySchema.safeParse('2024-02-29').success, true);
  assert.equal(dateOnlySchema.safeParse('2026-02-29').success, false);
  assert.equal(detailedReportQuerySchema.safeParse({ data_inicio: '2026-10-25', data_fim: '2026-10-05' }).success, false);
  assert.equal(detailedReportQuerySchema.safeParse({ data_inicio: '2020-01-01', data_fim: '2026-01-01' }).success, false);
  assert.equal(listTransactionsQuerySchema.safeParse({ data_inicio: '2026-10-25', data_fim: '2026-10-05' }).success, false);
});
test('dinheiro finito, positivo, duas casas e limite do banco', () => {
  for (const value of [0, -1, NaN, Infinity, 0.001, 100000000]) assert.equal(moneySchema.safeParse(value).success, false);
  for (const value of [0.01, 0.1 + 0.2, 99999999.99]) assert.equal(moneySchema.safeParse(value).success, true);
  assert.equal(createGoalSchema.safeParse({ titulo: 'Meta', valor_objetivo: 10, data_inicio: '2026-10-25', data_fim: '2026-10-05' }).success, false);
  assert.equal(updateGoalSchema.safeParse({ descricao: null, data_fim: null }).success, true);
});
test('intervalo anterior inclui o mesmo número de dias e atravessa o ano', () => {
  assert.deepEqual(previousReportRange('2026-01-01','2026-01-03'), { start:'2025-12-29', end:'2025-12-31' });
  assert.deepEqual(previousReportRange('2024-03-01','2024-03-01'), { start:'2024-02-29', end:'2024-02-29' });
});
test('relatório respeita datas inclusivas, centavos, saldo negativo e meses vazios', () => {
  const result=buildDetailedReport('2025-12-31','2026-03-01', [tx(1,'2025-12-30',1000),tx(2,'2025-12-31',0.1),tx(3,'2026-01-01',0.2),tx(4,'2026-03-01',1,'despesa'),tx(5,'2026-03-02',2000)], []);
  assert.equal(result.summary.receitas,0.3); assert.equal(result.summary.despesas,1);assert.equal(result.summary.saldo,-0.7);
  assert.deepEqual(result.transactions.map((item)=>item.id),[4,3,2]);
  assert.equal(result.evolution.length,4);assert.equal(result.evolution[2]?.saldo,0);
  assert.equal(result.categoryBreakdown[0]?.total,1); assert.equal(result.categoryBreakdown[0]?.percentual,100);
});
test('comparações usam o período anterior, com denominador absoluto e base zero nula', () => {
  const result=buildDetailedReport('2026-10-01','2026-10-02',[tx(1,'2026-09-29',100,'despesa'),tx(2,'2026-10-01',200)],[]);
  assert.equal(result.summary.variacaoReceitas,null); assert.equal(result.summary.variacaoSaldo,300); assert.equal(result.summary.variacaoDespesas,-100);
  const empty=buildDetailedReport('2026-10-01','2026-10-01',[],[]);
  assert.equal(empty.evolution.length,1); assert.equal(empty.summary.saldo,0); assert.equal(empty.insights[0]?.tipo,'neutro');
});
