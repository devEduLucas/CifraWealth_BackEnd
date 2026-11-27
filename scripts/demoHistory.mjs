// Fixed synthetic reference ledger, independent of the application's report maths.
export const prefix = '[QA5M]';
export const start = '2026-06-01';
export const today = '2026-11-25';
export const transactions = [];
const salaries = [420000, 420000, 430050, 430050, 460075, 460075];
for (let m = 6; m <= 11; m++) {
  const month = `2026-${String(m).padStart(2, '0')}`;
  const add = (day, description, cents, category, type = 'despesa', status = 'confirmada') => transactions.push({
    descricao: `${prefix} ${description} ${month}`, cents, tipo: type, status,
    data_transacao: `${month}-${String(day).padStart(2, '0')}`, category,
  });
  add(5, 'Salário', salaries[m - 6], 'Salário', 'receita');
  if (m % 2 === 0) add(17, 'Projeto extra', 65075 + m * 100, 'Freelance', 'receita');
  add(20, 'Rendimento', 1837 + m * 10, 'Investimentos', 'receita');
  add(1, 'Aluguel', 125000, 'Moradia');
  add(7, 'Energia', 13242 + m * 187, 'Moradia');
  add(9, 'Internet', 9990, 'Serviços');
  add(11, 'Celular', 4990, 'Serviços');
  for (const day of [3, 10, 18, 24]) add(day, `Mercado ${day}`, 13525 + m * 317 + day * 53, 'Alimentação');
  add(8, 'Transporte', 21575 + m * 400, 'Transporte');
  add(16, 'Cinema e passeio', 16890 + m * 200, 'Lazer');
  add(21, 'Curso', 14990, 'Educação');
  add(22, 'Farmácia', 8753 + m * 99, 'Saúde');
  if (m === 8) add(12, 'Reparo e eletrodomésticos', 310099, 'Moradia');
  if (m === 9) add(13, 'Tratamento', 180000, 'Saúde');
}
for (const [date, description, cents, category, type, status] of [
  ['2026-07-31', 'Ajuste de centavo', 1, 'Freelance', 'receita', 'confirmada'],
  ['2026-08-01', 'Ajuste de despesa', 29, 'Serviços', 'despesa', 'confirmada'],
  ['2026-06-30', 'Pendência antiga', 8900, 'Serviços', 'despesa', 'pendente'],
  ['2026-11-25', 'Conta para confirmar', 17789, 'Moradia', 'despesa', 'pendente'],
  ['2026-11-30', 'Despesa futura confirmada', 38975, 'Serviços', 'despesa', 'confirmada'],
  ['2026-12-05', 'Salário previsto', 460075, 'Salário', 'receita', 'pendente'],
]) transactions.push({ descricao: `${prefix} ${description}`, data_transacao: date, cents, category, tipo: type, status });

export const categories = [
  ['Moradia', '#2563eb', 'home'], ['Serviços', '#64748b', 'receipt'],
  ['Educação', '#a855f7', 'book'], ['Saúde', '#ec4899', 'heart'],
];
export const goals = [
  { titulo: `${prefix} Reserva de emergência`, valor_objetivo: 18000, valor_atual: 6750.58, data_inicio: start, data_fim: '2027-06-30', status: 'em_andamento' },
  { titulo: `${prefix} Viagem de férias`, valor_objetivo: 4500, valor_atual: 1305, data_inicio: '2026-08-01', data_fim: '2027-02-20', status: 'em_andamento' },
  { titulo: `${prefix} Curso concluído`, valor_objetivo: 1500, valor_atual: 1500, data_inicio: start, data_fim: '2026-10-31', status: 'concluida' },
  { titulo: `${prefix} Plano cancelado`, valor_objetivo: 1200, valor_atual: 100, data_inicio: '2026-07-01', data_fim: '2026-09-30', status: 'cancelada' },
];

export function oracle(items, first, last, cutoff = today) {
  const rows = items.filter((t) => t.status === 'confirmada' && t.data_transacao >= first && t.data_transacao <= last && t.data_transacao <= cutoff);
  const income = rows.filter((t) => t.tipo === 'receita').reduce((s, t) => s + (t.cents ?? Math.round(t.valor * 100)), 0);
  const expense = rows.filter((t) => t.tipo === 'despesa').reduce((s, t) => s + (t.cents ?? Math.round(t.valor * 100)), 0);
  return { count: rows.length, receitas: income / 100, despesas: expense / 100, saldo: (income - expense) / 100 };
}
