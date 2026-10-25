import { z } from "zod";

export const registerUserSchema = z.object({
  fullName: z.string().trim().min(3, "Nome completo deve ter no mínimo 3 caracteres.").refine((value) => {
    const [first = "", ...rest] = value.split(/\s+/);
    return first.length <= 50 && rest.join(" ").length <= 50;
  }, "Nome e sobrenome devem ter até 50 caracteres cada."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  password: z
    .string()
    .min(8, "A senha deve ter no mínimo 8 caracteres.")
    .refine((val) => Buffer.byteLength(val, "utf8") <= 72, "A senha não pode exceder 72 bytes."),
});

export type RegisterUserInput = z.infer<typeof registerUserSchema>;

export const verifyEmailSchema = z.object({
  token: z.string().min(1, "Token de confirmação é obrigatório."),
  password: z
    .string()
    .min(8, "Informe a senha escolhida no cadastro.")
    .refine((value) => Buffer.byteLength(value, "utf8") <= 72, "A senha não pode exceder 72 bytes."),
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

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
});

export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(1, "Token de redefinição é obrigatório."),
  password: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .refine((val) => Buffer.byteLength(val, "utf8") <= 72, "A senha não pode exceder 72 bytes."),
});

export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// Schema para atualização de perfil
export const updateProfileSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(3, "Nome completo deve ter no mínimo 3 caracteres.")
    .refine((value) => {
      const [first = "", ...rest] = value.split(/\s+/);
      return first.length <= 50 && rest.join(" ").length <= 50;
    }, "Nome e sobrenome devem ter até 50 caracteres cada.")
    .optional(),
  nome: z.string().trim().min(2, "Nome deve ter no mínimo 2 caracteres.").max(50).optional(),
  sobrenome: z.string().trim().max(50).nullable().optional(),
  foto_perfil: z.string().max(255).nullable().optional(),
  capa_perfil: z.string().max(255).nullable().optional(),
  currentPassword: z.string().min(1, "Informe a senha atual.").optional(),
  newPassword: z
    .string()
    .min(8, "A nova senha deve ter no mínimo 8 caracteres.")
    .refine((val) => Buffer.byteLength(val, "utf8") <= 72, "A senha não pode exceder 72 bytes.")
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

// Schema para exclusão de conta
export const deleteAccountSchema = z.union([
  z.object({ 
    password: z
      .string()
      .min(1, 'Informe sua senha para confirmar.')
      .refine((value) => Buffer.byteLength(value, 'utf8') <= 72, 'A senha não pode exceder 72 bytes.') 
  }).strict(),
  z.object({ 
    googleIdToken: z.string().min(1).max(12000), 
    challengeToken: z.string().min(1).max(4096) 
  }).strict(),
]);

export type DeleteAccountInput = z.infer<typeof deleteAccountSchema>;