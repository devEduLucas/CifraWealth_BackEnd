import { prisma } from '../lib/prisma.js';
import { Prisma, type transacoes } from '../generated/prisma/client.js';
import { parseDateOnly, todayDateOnly, toDateOnlyString } from '../utils/formatDate.js';
import { toMoneyNumber } from '../utils/money.js';
import type { TransactionPageQuery, CategoryUsageQuery } from '../types/historyQuery.types.js';

function filtersFor(userId: number, query: TransactionPageQuery, today: Date) {
  const filters = [Prisma.sql`t.id_usuario = ${userId}`];
  if (query.kind) filters.push(Prisma.sql`t.tipo = ${query.kind}`);
  if (query.category) filters.push(Prisma.sql`t.id_categoria = ${query.category}`);
  if (query.start) filters.push(Prisma.sql`t.data_transacao >= ${parseDateOnly(query.start)}`);
  if (query.end) filters.push(Prisma.sql`t.data_transacao <= ${parseDateOnly(query.end)}`);
  if (query.state === 'prevista') filters.push(Prisma.sql`t.data_transacao > ${today}`);
  else if (query.state) filters.push(Prisma.sql`t.data_transacao <= ${today} AND COALESCE(t.status, 'confirmada') = ${query.state}`);
  if (query.search) {
    // The schema uses utf8mb4_unicode_ci; literal %, _ and = must not become LIKE operators.
    const search = '%' + query.search.replace(/[=%_]/g, '=$&') + '%';
    filters.push(Prisma.sql`CONCAT(t.descricao, ' ', c.nome) LIKE ${search} ESCAPE '='`);
  }
  return Prisma.join(filters, ' AND ');
}

export const historyQueryService = {
  async transactions(userId: number, query: TransactionPageQuery) {
    const today = parseDateOnly(todayDateOnly());
    const where = filtersFor(userId, query, today);
    const direction = query.order === 'oldest' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    // One consistent snapshot keeps the count, totals and page aligned during concurrent writes.
    return prisma.$transaction(async (tx) => {
      const [row] = await tx.$queryRaw<Array<{
        total: bigint; income: Prisma.Decimal | null; expense: Prisma.Decimal | null; pending: Prisma.Decimal | null; scheduled: Prisma.Decimal | null;
      }>>(Prisma.sql`SELECT COUNT(*) AS total,
        SUM(CASE WHEN t.data_transacao <= ${today} AND COALESCE(t.status, 'confirmada') = 'confirmada' AND t.tipo = 'receita' THEN t.valor ELSE 0 END) AS income,
        SUM(CASE WHEN t.data_transacao <= ${today} AND COALESCE(t.status, 'confirmada') = 'confirmada' AND t.tipo = 'despesa' THEN t.valor ELSE 0 END) AS expense,
        SUM(CASE WHEN t.data_transacao <= ${today} AND t.status = 'pendente' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN t.data_transacao > ${today} THEN 1 ELSE 0 END) AS scheduled
        FROM transacoes t JOIN categorias c ON c.id_categoria = t.id_categoria AND c.id_usuario = ${userId} WHERE ${where}`);
      const total = Number(row?.total ?? 0);
      const page = Math.min(query.pageNumber, Math.max(1, Math.ceil(total / query.pageSize)));
      const items = total ? await tx.$queryRaw<transacoes[]>(Prisma.sql`SELECT t.* FROM transacoes t
        JOIN categorias c ON c.id_categoria = t.id_categoria AND c.id_usuario = ${userId} WHERE ${where}
        ORDER BY t.data_transacao ${direction}, t.id_transacao ${direction}
        LIMIT ${BigInt(query.pageSize)} OFFSET ${BigInt((page - 1) * query.pageSize)}`) : [];
      const income = toMoneyNumber(row?.income ?? new Prisma.Decimal(0));
      const expense = toMoneyNumber(row?.expense ?? new Prisma.Decimal(0));
      const hasHistory = total > 0 || await tx.transacoes.count({ where: { id_usuario: userId }, take: 1 }) > 0;
      return {
        items: items.map((item) => ({ id_transacao: item.id_transacao, id_categoria: item.id_categoria, descricao: item.descricao,
          tipo: item.tipo, status: item.status ?? 'confirmada', valor: toMoneyNumber(item.valor), data_transacao: toDateOnlyString(item.data_transacao) })),
        total, page, pageSize: query.pageSize, hasHistory,
        summary: { income, expense, result: (Math.round(income * 100) - Math.round(expense * 100)) / 100, pending: Number(row?.pending ?? 0), scheduled: Number(row?.scheduled ?? 0) },
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead });
  },

  async categories(userId: number, query: CategoryUsageQuery) {
    const today = todayDateOnly();
    const end = parseDateOnly(query.end && query.end < today ? query.end : today);
    const start = query.start ? Prisma.sql`AND t.data_transacao >= ${parseDateOnly(query.start)}` : Prisma.empty;
    const realized = Prisma.sql`t.tipo = c.tipo AND COALESCE(t.status, 'confirmada') = 'confirmada' AND t.data_transacao <= ${end} ${start}`;
    const rows = await prisma.$queryRaw<Array<{ id_categoria: number; amount: Prisma.Decimal | null; count: Prisma.Decimal; historyCount: bigint }>>(Prisma.sql`
      SELECT c.id_categoria, SUM(CASE WHEN ${realized} THEN t.valor ELSE 0 END) AS amount,
        SUM(CASE WHEN ${realized} THEN 1 ELSE 0 END) AS count, COUNT(t.id_transacao) AS historyCount
      FROM categorias c LEFT JOIN transacoes t ON t.id_categoria = c.id_categoria AND t.id_usuario = ${userId}
      WHERE c.id_usuario = ${userId} GROUP BY c.id_categoria`);
    return { items: rows.map((row) => ({ id_categoria: row.id_categoria, amount: toMoneyNumber(row.amount ?? new Prisma.Decimal(0)), count: Number(row.count), historyCount: Number(row.historyCount) })) };
  },
};
