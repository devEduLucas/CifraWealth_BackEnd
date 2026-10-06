import { z } from "zod";

export const dateOnlySchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato AAAA-MM-DD.").refine((value) => {
  const parsed = new Date(value + "T00:00:00.000Z");
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, "Data inválida.");

export const moneySchema = z.number().finite().positive("Valor deve ser maior que zero.").max(99999999.99, "Valor máximo: R$ 99.999.999,99.").refine((value) => Math.abs(value * 100 - Math.round(value * 100)) < 0.00001, "Use no máximo duas casas decimais.");

export function datesInOrder(value: { data_inicio?: string | null | undefined; data_fim?: string | null | undefined }): boolean {
  return !value.data_inicio || !value.data_fim || value.data_inicio <= value.data_fim;
}
