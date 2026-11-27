import { z } from 'zod';
import { dateOnlySchema } from '../utils/validationSchemas.js';

const period = { start: dateOnlySchema.optional(), end: dateOnlySchema.optional() };
const ordered = (value: { start?: string | undefined; end?: string | undefined }) => !value.start || !value.end || value.start <= value.end;
export const transactionPageQuerySchema = z.object({
  ...period,
  kind: z.enum(['receita', 'despesa']).optional(),
  state: z.enum(['confirmada', 'pendente', 'prevista']).optional(),
  category: z.coerce.number().int().positive().optional(),
  search: z.string().trim().max(250).default(''),
  order: z.enum(['newest', 'oldest']).default('newest'),
  pageNumber: z.coerce.number().int().positive().max(1000000).default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
}).refine(ordered, 'Data inicial deve ser igual ou anterior à final.');
export const categoryUsageQuerySchema = z.object(period).refine(ordered, 'Data inicial deve ser igual ou anterior à final.');
export type TransactionPageQuery = z.infer<typeof transactionPageQuerySchema>;
export type CategoryUsageQuery = z.infer<typeof categoryUsageQuerySchema>;
