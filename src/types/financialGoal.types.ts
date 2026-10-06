import { z } from "zod";
import { dateOnlySchema, datesInOrder, moneySchema } from "../utils/validationSchemas.js";

export const goalStatusSchema = z.enum(["em_andamento", "concluida", "cancelada"]);
const goalFields = z.object({
  titulo: z.string().trim().min(1, "Título é obrigatório.").max(100),
  descricao: z.string().trim().max(255).nullable().optional(),
  valor_objetivo: moneySchema,
  data_inicio: dateOnlySchema.nullable().optional(),
  data_fim: dateOnlySchema.nullable().optional(),
});
export const createGoalSchema = goalFields.refine(datesInOrder, "Prazo deve ser igual ou posterior à data de início.");
export const updateGoalSchema = goalFields.partial().extend({ status: goalStatusSchema.optional() }).refine(datesInOrder, "Prazo deve ser igual ou posterior à data de início.");
export const contributeGoalSchema = z.object({ valor: moneySchema });
export type CreateGoalInput = z.infer<typeof createGoalSchema>;
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;
export type ContributeGoalInput = z.infer<typeof contributeGoalSchema>;
export interface GoalResponse {
  id_meta: number;
  titulo: string;
  descricao: string | null;
  valor_objetivo: number;
  valor_atual: number;
  status: "em_andamento" | "concluida" | "cancelada";
  data_inicio: string | null;
  data_fim: string | null;
}
