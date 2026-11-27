import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seedDemoAccount, normalizeApi } from '../scripts/seedDemo.mjs';
import { transactions as plan } from '../scripts/demoHistory.mjs';

function apiFixture({ status = 200, wrongAccount = false, conflict = false, failAt = 0 } = {}) {
  const original = { id_transacao: 1, id_categoria: 1, descricao: 'Registro original', valor: 12.34, tipo: 'despesa', status: 'confirmada', data_transacao: '2026-10-01' };
  const transactions = [structuredClone(original)];
  if (conflict) transactions.push({ id_transacao: 2, id_categoria: 1, ...plan[0], valor: plan[0].cents / 100 + 1 });
  const categories = [{ id_categoria: 1, nome: 'Original', tipo: 'despesa' }];
  const goals = [{ id_meta: 1, titulo: 'Meta original', valor_atual: 30, status: 'em_andamento' }];
  const calls = []; let next = 100; let transactionWrites = 0; let failurePending = failAt > 0;
  const json = (value, code = 200) => new Response(JSON.stringify(value), { status: code, headers: { 'Content-Type': 'application/json' } });
  const fetchImpl = async (url, options) => {
    const path = new URL(url).pathname.replace('/api', '');
    const method = options.method; const data = options.body && JSON.parse(options.body);
    calls.push({ path, method });
    assert.equal(options.redirect, 'error');
    if (path === '/auth/login') return json(status === 200 ? { token: 'fixture-only', user: { id_usuario: 88, email: wrongAccount ? 'different@example.test' : 'demo@example.test' } } : { message: 'Invalid login' }, status);
    assert.equal(options.headers.Authorization, 'Bearer fixture-only');
    if (path === '/transactions' && method === 'POST') {
      transactionWrites++;
      if (failurePending && transactionWrites === failAt) { failurePending = false; return json({}, 503); }
      const created = { id_transacao: next++, ...data }; transactions.push(created); return json(created, 201);
    }
    if (path === '/categories' && method === 'POST') { const created = { id_categoria: next++, ...data }; categories.push(created); return json(created, 201); }
    if (path === '/goals' && method === 'POST') { const created = { id_meta: next++, valor_atual: 0, status: 'em_andamento', ...data }; goals.push(created); return json(created, 201); }
    if (path.startsWith('/goals/') && method === 'PUT') { const goal = goals.find((g) => g.id_meta === Number(path.split('/').pop())); Object.assign(goal, data); return json(goal); }
    if (path === '/transactions') return json(transactions);
    if (path === '/categories') return json(categories);
    if (path === '/goals') return json(goals);
    throw Error('Unexpected fixture request');
  };
  return { original, transactions, categories, goals, calls, fetchImpl };
}
const options = { api: 'https://api.example.test/api', email: 'demo@example.test', password: 'fixture-not-a-real-secret', apply: true };

test('demonstração apenas planeja por padrão, sem credencial ou requisição', async () => {
  const result = await seedDemoAccount({ api: options.api, fetchImpl: () => { throw Error('No network allowed'); } });
  assert.equal(result.dryRun, true); assert.equal(result.plan.transactions, 95); assert.equal(result.plan.goals, 4);
});

test('importador aceita HTTPS/HTTP local e rejeita credencial na URL ou HTTP remoto', () => {
  assert.equal(normalizeApi('http://localhost:3000/api/'), 'http://localhost:3000/api');
  for (const url of ['http://api.example.test/api', 'https://user:secret@api.example.test/api', 'https://api.example.test/api?token=secret', 'file:///tmp/demo', 'javascript:alert(1)']) assert.throws(() => normalizeApi(url));
});

test('login recusado ou conta divergente não escreve nenhum registro', async () => {
  for (const config of [{ status: 401 }, { wrongAccount: true }]) {
    const mock = apiFixture(config);
    await assert.rejects(seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl }));
    assert.deepEqual(mock.calls, [{ path: '/auth/login', method: 'POST' }]);
    assert.deepEqual(mock.transactions, [mock.original]);
  }
});

test('importação preserva registros anteriores e nova execução não duplica o histórico', async () => {
  const mock = apiFixture();
  const first = await seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl });
  assert.equal(first.added.transactions, 95); assert.equal(first.added.goals, 4); assert.equal(first.totalTransactions, 96);
  assert.deepEqual(mock.transactions[0], mock.original); assert.equal(mock.goals[0].valor_atual, 30);
  const second = await seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl });
  assert.deepEqual(second.added, { transactions: 0, categories: 0, goals: 0 });
  assert.equal(mock.transactions.length, 96); assert.equal(mock.goals.length, 5);
});

test('dado fictício já editado interrompe antes de escrever sem substituir a edição', async () => {
  const mock = apiFixture({ conflict: true });
  await assert.rejects(seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl }), /alterado ou duplicado/);
  assert.equal(mock.calls.filter((c) => c.method !== 'GET' && c.path !== '/auth/login').length, 0);
});

test('uma interrupção pode ser retomada sem duplicar os lançamentos já salvos', async () => {
  const mock = apiFixture({ failAt: 4 });
  await assert.rejects(seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl }), /HTTP 503/);
  assert.equal(mock.transactions.length, 4);
  const retry = await seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl });
  assert.equal(retry.added.transactions, 92); assert.equal(mock.transactions.length, 96);
  assert.equal(new Set(mock.transactions.map((t) => t.descricao + ':' + t.data_transacao)).size, 96);
});

test('troca de categoria de uma fixture também impede importar sem sobrescrever a edição', async () => {
  const mock = apiFixture();
  mock.transactions.push({ id_transacao: 2, id_categoria: 1, ...plan[0], valor: plan[0].cents / 100 });
  await assert.rejects(seedDemoAccount({ ...options, fetchImpl: mock.fetchImpl }), /alterado ou duplicado/);
  assert.equal(mock.calls.filter((c) => c.method !== 'GET' && c.path !== '/auth/login').length, 0);
});
