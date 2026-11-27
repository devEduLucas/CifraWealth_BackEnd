import { test } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { app } from '../src/app.js';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { sessionVersion, signToken } from '../src/utils/jwt.js';
import { todayDateOnly, parseDateOnly } from '../src/utils/formatDate.js';

test('histórico paginado preserva centavos, busca, totais, isolamento e contrato legado', async () => {
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(new URL(env.DATABASE_URL).hostname), 'Este teste usa somente MySQL local.');
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const ids: number[] = [];
  try {
    for (const suffix of ['a', 'b']) {
      const user = await prisma.usuarios.create({ data: { nome: 'Histórico de teste', email: `history-${suffix}-${randomUUID()}@example.test`, email_verificado: true } });
      ids.push(user.id_usuario);
    }
    const userId = ids[0]!;
    const account = await prisma.usuarios.findUniqueOrThrow({ where: { id_usuario: userId } });
    const token = signToken({ userId, credentialVersion: sessionVersion(account) });
    const income = await prisma.categorias.create({ data: { id_usuario: userId, nome: 'Trabalho', tipo: 'receita' } });
    const expense = await prisma.categorias.create({ data: { id_usuario: userId, nome: 'Moradia', tipo: 'despesa' } });
    const today = todayDateOnly();
    const tomorrow = new Date(parseDateOnly(today)); tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    const past = new Date(parseDateOnly(today)); past.setUTCFullYear(past.getUTCFullYear() - 1);
    await prisma.transacoes.createMany({ data: [
      ...Array.from({ length: 45 }, (_, i) => ({ id_usuario: userId, id_categoria: income.id_categoria, tipo: 'receita' as const, descricao: `Salário ${i}`, valor: '1.01', status: 'confirmada' as const, data_transacao: parseDateOnly(today) })),
      ...Array.from({ length: 3 }, () => ({ id_usuario: userId, id_categoria: expense.id_categoria, tipo: 'despesa' as const, descricao: 'Aluguel % literal', valor: '0.02', status: 'confirmada' as const, data_transacao: parseDateOnly(today) })),
      { id_usuario: userId, id_categoria: expense.id_categoria, tipo: 'despesa', descricao: 'Pendente', valor: '50', status: 'pendente', data_transacao: parseDateOnly(today) },
      { id_usuario: userId, id_categoria: income.id_categoria, tipo: 'receita', descricao: 'Futura', valor: '99', status: 'confirmada', data_transacao: tomorrow },
      { id_usuario: userId, id_categoria: expense.id_categoria, tipo: 'despesa', descricao: 'Histórica', valor: '200', status: 'confirmada', data_transacao: past },
    ] });
    const other = await prisma.categorias.create({ data: { id_usuario: ids[1]!, nome: 'Outra conta', tipo: 'receita' } });
    await prisma.transacoes.create({ data: { id_usuario: ids[1]!, id_categoria: other.id_categoria, tipo: 'receita', descricao: 'Privada', valor: 777, data_transacao: parseDateOnly(today) } });
    async function get(path: string, expected = 200, authenticated = true) {
      const response = await fetch(`http://127.0.0.1:${port}/api${path}`, { headers: authenticated ? { Authorization: 'Bearer ' + token } : {}, signal: AbortSignal.timeout(10000) });
      assert.equal(response.status, expected);
      return response.json();
    }
    const first = await get('/transactions?view=page');
    assert.equal(first.items.length, 20); assert.equal(first.total, 51); assert.equal(first.page, 1);
    assert.deepEqual(first.summary, { income: 45.45, expense: 200.06, result: -154.61, pending: 1, scheduled: 1 });
    const second = await get('/transactions?view=page&pageNumber=2');
    const last = await get('/transactions?view=page&pageNumber=999');
    assert.equal(last.page, 3); assert.equal(last.items.length, 11);
    assert.equal(new Set([...first.items, ...second.items, ...last.items].map((item) => item.id_transacao)).size, 51);
    assert.equal((await get('/transactions?view=page&state=prevista')).total, 1);
    assert.equal((await get('/transactions?view=page&state=pendente')).total, 1);
    assert.equal((await get('/transactions?view=page&state=confirmada')).total, 49);
    assert.equal((await get('/transactions?view=page&search=salario%201%20trabalho')).total, 1);
    assert.equal((await get('/transactions?view=page&search=%25')).total, 3);
    const empty = await get('/transactions?view=page&search=inexistente');
    assert.equal(empty.total, 0); assert.equal(empty.hasHistory, true); assert.equal(empty.summary.income, 0);
    const oldest = await get('/transactions?view=page&order=oldest&pageSize=1');
    assert.equal(oldest.items[0].descricao, 'Histórica');
    const usage = (await get('/categories?view=usage&start=' + today + '&end=' + today)).items;
    assert.deepEqual(usage.find((item: { id_categoria: number }) => item.id_categoria === income.id_categoria), { id_categoria: income.id_categoria, amount: 45.45, count: 45, historyCount: 46 });
    assert.deepEqual(usage.find((item: { id_categoria: number }) => item.id_categoria === expense.id_categoria), { id_categoria: expense.id_categoria, amount: 0.06, count: 3, historyCount: 5 });
    assert.equal(usage.length, 2);
    assert.ok(Array.isArray(await get('/transactions'))); assert.equal((await get('/transactions?limit=2&page=2')).length, 2);
    assert.ok(Array.isArray(await get('/categories')));
    await get('/transactions?view=page&pageSize=101', 400);
    await get('/transactions?view=page&start=2026-11-30&end=2026-11-01', 400);
    await get('/transactions?view=page', 401, false);
    await get('/categories?view=usage', 401, false);
  } finally {
    if (ids.length) {
      await prisma.transacoes.deleteMany({ where: { id_usuario: { in: ids } } });
      await prisma.categorias.deleteMany({ where: { id_usuario: { in: ids } } });
      await prisma.usuarios.deleteMany({ where: { id_usuario: { in: ids } } });
    }
    await new Promise<void>((resolve) => server.close(() => resolve())); await prisma.$disconnect();
  }
});
