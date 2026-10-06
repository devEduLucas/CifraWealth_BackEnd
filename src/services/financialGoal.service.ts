import { financialGoalRepository } from "../repositories/financialGoal.repository.js";
import { AppError } from "../utils/AppError.js";
import { parseDateOnly, toDateOnlyString } from "../utils/formatDate.js";
import { toDecimal, toMoneyNumber } from "../utils/money.js";
import type {
  ContributeGoalInput,
  CreateGoalInput,
  GoalResponse,
  UpdateGoalInput,
} from "../types/financialGoal.types.js";

function toGoalResponse(goal: {
  id_meta: number;
  titulo: string;
  descricao: string | null;
  valor_objetivo: unknown;
  valor_atual: unknown;
  status: string | null;
  data_inicio: Date | null;
  data_fim: Date | null;
}): GoalResponse {
  return {
    id_meta: goal.id_meta,
    titulo: goal.titulo,
    descricao: goal.descricao,
    valor_objetivo: toMoneyNumber(goal.valor_objetivo as never),
    valor_atual: toMoneyNumber(goal.valor_atual as never),
    status: (goal.status ?? "em_andamento") as GoalResponse["status"],
    data_inicio: goal.data_inicio ? toDateOnlyString(goal.data_inicio) : null,
    data_fim: goal.data_fim ? toDateOnlyString(goal.data_fim) : null,
  };
}

export const financialGoalService = {
  async list(userId: number): Promise<GoalResponse[]> {
    const goals = await financialGoalRepository.findAllByUser(userId);
    return goals.map(toGoalResponse);
  },

  async getById(id: number, userId: number): Promise<GoalResponse> {
    const goal = await financialGoalRepository.findByIdAndUser(id, userId);

    if (!goal) {
      throw new AppError("Meta financeira não encontrada.", 404);
    }

    return toGoalResponse(goal);
  },

  async create(userId: number, input: CreateGoalInput): Promise<GoalResponse> {
    const goal = await financialGoalRepository.create(userId, {
      titulo: input.titulo,
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      valor_objetivo: toDecimal(input.valor_objetivo),
      ...(input.data_inicio !== undefined && { data_inicio: input.data_inicio ? parseDateOnly(input.data_inicio) : null }),
      ...(input.data_fim !== undefined && { data_fim: input.data_fim ? parseDateOnly(input.data_fim) : null }),
    });

    return toGoalResponse(goal);
  },

  async update(id: number, userId: number, input: UpdateGoalInput): Promise<GoalResponse> {
    await financialGoalService.getById(id, userId);

    const goal = await financialGoalRepository.update(id, userId, {
      ...(input.titulo !== undefined && { titulo: input.titulo }),
      ...(input.descricao !== undefined && { descricao: input.descricao }),
      ...(input.valor_objetivo !== undefined && {
        valor_objetivo: toDecimal(input.valor_objetivo),
      }),
      ...(input.status !== undefined && { status: input.status }),
      ...(input.data_inicio !== undefined && { data_inicio: input.data_inicio ? parseDateOnly(input.data_inicio) : null }),
      ...(input.data_fim !== undefined && { data_fim: input.data_fim ? parseDateOnly(input.data_fim) : null }),
    });

    return toGoalResponse(goal);
  },

  async contribute(id: number, userId: number, input: ContributeGoalInput): Promise<GoalResponse> {
    const goal = await financialGoalRepository.contribute(id, userId, toDecimal(input.valor));
    return toGoalResponse(goal);
  },

  async remove(id: number, userId: number): Promise<void> {
    await financialGoalService.getById(id, userId);
    await financialGoalRepository.delete(id, userId);
  },
};
