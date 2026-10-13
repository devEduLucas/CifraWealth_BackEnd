import { z } from "zod";

export const registerUserSchema = z.object({
  fullName: z.string().trim().min(3, "Nome completo deve ter no mínimo 3 caracteres."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(8, "A senha deve ter no mínimo 8 caracteres."),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token de confirmação é obrigatório."),
});

export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
});

export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;

export const loginUserSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z.string().min(1, "Informe a senha."),
});

export type LoginUserInput = z.infer<typeof loginUserSchema>;

export const googleLoginSchema = z.object({
  idToken: z.string().min(1, "Token do Google é obrigatório."),
});

export type GoogleLoginInput = z.infer<typeof googleLoginSchema>;

export interface UserResponse {
  id_usuario: number;
  nome: string;
  sobrenome: string | null;
  email: string;
}

export interface AuthResponse {
  user: UserResponse;
  token: string;
}