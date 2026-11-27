import { createInterface, emitKeypressEvents } from 'node:readline';
import { pathToFileURL } from 'node:url';
import { transactions, goals, categories, oracle, start, today } from './demoHistory.mjs';

export function normalizeApi(value) {
  const url = new URL(value);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
    throw new Error('Use uma URL HTTPS da API ou HTTP local, sem credenciais, parâmetros ou fragmentos.');
  }
  return url.href.replace(/\/+$/, '');
}

export function demonstrationPlan() {
  return { first: start, last: today, transactions: transactions.length, goals: goals.length,
    realized: oracle(transactions, start, today), marker: '[QA5M]', existingRecords: 'preservados' };
}

/** Append fixtures only to the account that authenticated. No database/admin access. */
export async function seedDemoAccount({ api, email, password, apply = false, fetchImpl = fetch }) {
  const base = normalizeApi(api);
  if (!apply) return { dryRun: true, api: base, plan: demonstrationPlan() };
  if (!email || !password) throw new Error('Informe o e-mail e a senha da conta de demonstração.');
  let token;
  async function request(path, method = 'GET', body) {
    const response = await fetchImpl(base + path, {
      method, redirect: 'error', signal: AbortSignal.timeout(45000),
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      // Do not print a request, bearer token, server response, or credentials.
      throw new Error(`${method} ${path.split('?')[0]}: HTTP ${response.status}. ${path === '/auth/login' ? 'Confira a conta e o funcionamento do backend antes de importar.' : 'A importação parou; os dados existentes foram preservados. É possível executar novamente.'}`);
    }
    return data;
  }
  try {
    const auth = await request('/auth/login', 'POST', { email, password });
    if (!auth.token || auth.user?.email?.toLowerCase() !== email.trim().toLowerCase()) throw new Error('A API não confirmou a conta solicitada. Nenhum lançamento foi criado.');
    token = auth.token;
    const [savedTransactions, savedGoals, savedCategories] = await Promise.all([
      request('/transactions'), request('/goals'), request('/categories'),
    ]);
    if (![savedTransactions, savedGoals, savedCategories].every(Array.isArray)) throw new Error('Resposta incompatível da API. Nenhum lançamento foi criado.');
    const categoryKey = (name, type) => type + ':' + name.trim().toLocaleLowerCase('pt-BR');
    const byCategory = new Map(savedCategories.map((c) => [categoryKey(c.nome, c.tipo), c]));
    const categoryById = new Map(savedCategories.map((c) => [c.id_categoria, c]));
    const missingTransactions = [];
    for (const item of transactions) {
      const existing = savedTransactions.filter((t) => t.descricao === item.descricao && t.data_transacao === item.data_transacao);
      if (!existing.length) { missingTransactions.push(item); continue; }
      const existingCategory = categoryById.get(existing[0].id_categoria);
      const categoryChanged = !existingCategory || categoryKey(existingCategory.nome, existingCategory.tipo) !== categoryKey(item.category, item.tipo);
      if (existing.length > 1 || categoryChanged || existing[0].tipo !== item.tipo || Math.round(existing[0].valor * 100) !== item.cents || existing[0].status !== item.status) {
        throw new Error('Há um lançamento [QA5M] já alterado ou duplicado. Nenhum registro foi sobrescrito. Revise a conta antes de importar novamente.');
      }
    }
    const categoryPlans = [
      ['Salário', '#22c55e', 'wallet', 'receita'], ['Freelance', '#10b981', 'briefcase', 'receita'],
      ['Investimentos', '#059669', 'chart-line', 'receita'], ['Alimentação', '#f97316', 'utensils', 'despesa'],
      ['Transporte', '#3b82f6', 'car', 'despesa'], ['Lazer', '#a855f7', 'gamepad', 'despesa'],
      ...categories.map(([name, color, icon]) => [name, color, icon, 'despesa']),
    ];
    const result = { dryRun: false, accountId: auth.user.id_usuario,
      preserved: { transactions: savedTransactions.length, categories: savedCategories.length, goals: savedGoals.length },
      added: { transactions: 0, categories: 0, goals: 0 }, warnings: [], plan: demonstrationPlan() };
    for (const [nome, cor, icone, tipo] of categoryPlans) {
      const key = categoryKey(nome, tipo);
      if (byCategory.has(key)) continue;
      const created = await request('/categories', 'POST', { nome, cor, icone, tipo });
      byCategory.set(key, created); result.added.categories++;
    }
    for (const item of missingTransactions) {
      const category = byCategory.get(categoryKey(item.category, item.tipo));
      if (!category?.id_categoria) throw new Error('Categoria necessária não foi encontrada; importação interrompida.');
      await request('/transactions', 'POST', { descricao: item.descricao, valor: item.cents / 100, tipo: item.tipo, status: item.status, data_transacao: item.data_transacao, id_categoria: category.id_categoria });
      result.added.transactions++;
    }
    for (const goal of goals) {
      const existing = savedGoals.find((g) => g.titulo === goal.titulo);
      if (existing) {
        if (Number(existing.valor_atual) !== goal.valor_atual || existing.status !== goal.status) result.warnings.push('Uma meta [QA5M] existente tem saldo ou situação diferente; ela foi preservada.');
        continue;
      }
      const { valor_atual, status, ...input } = goal;
      const created = await request('/goals', 'POST', { ...input, descricao: 'Histórico fictício de demonstração [QA5M].' });
      result.added.goals++;
      await request('/goals/' + created.id_meta, 'PUT', { valor_atual, status });
    }
    const after = await request('/transactions');
    for (const old of savedTransactions) {
      const current = after.find((t) => t.id_transacao === old.id_transacao);
      if (!current || ['descricao', 'valor', 'tipo', 'status', 'data_transacao', 'id_categoria'].some((key) => current[key] !== old[key])) {
        throw new Error('Os registros mudaram durante a execução. Confira a conta antes de continuar.');
      }
    }
    result.totalTransactions = after.length;
    return result;
  } finally { token = undefined; }
}

async function hiddenPassword() {
  if (!process.stdin.isTTY) throw new Error('Execute em um terminal interativo para informar a senha sem exibi-la.');
  process.stdout.write('Senha da conta (oculta): ');
  emitKeypressEvents(process.stdin); process.stdin.setRawMode(true); process.stdin.resume();
  return new Promise((resolve, reject) => {
    let value = '';
    function cleanup() { process.stdin.off('keypress', keypress); process.stdin.setRawMode(false); process.stdin.pause(); process.stdout.write('\n'); }
    function keypress(text, key = {}) {
      if (key.ctrl && key.name === 'c') { cleanup(); reject(new Error('Operação cancelada.')); }
      else if (key.name === 'return' || key.name === 'enter') { cleanup(); resolve(value); }
      else if (key.name === 'backspace') value = value.slice(0, -1);
      else if (text && !key.ctrl && !key.meta && !/[\x00-\x1f\x7f]/.test(text)) value += text;
    }
    process.stdin.on('keypress', keypress);
  });
}

async function main() {
  const args = process.argv.slice(2);
  const option = (name) => args.includes(name) ? args[args.indexOf(name) + 1] : undefined;
  const api = option('--api');
  if (!api) throw new Error('Uso: npm run demo:seed -- --api https://seu-backend/api [--email conta@exemplo.com --apply]');
  normalizeApi(api);
  if (args.includes('--password')) throw new Error('Não passe a senha como argumento; ela será solicitada de forma oculta.');
  const apply = args.includes('--apply');
  let email = option('--email');
  let password;
  try {
    if (apply) {
      if (!email) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        email = await new Promise((resolve) => rl.question('E-mail da conta de demonstração: ', resolve)); rl.close();
      }
      password = await hiddenPassword();
    }
    console.log(JSON.stringify(await seedDemoAccount({ api, email, password, apply }), null, 2));
  } finally { password = undefined; }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
