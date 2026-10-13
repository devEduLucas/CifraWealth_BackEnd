import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/AppError.js";
import { hashPassword } from "../utils/hashPassword.js";
import type { RegisterUserInput, ResendVerificationInput, UserResponse, VerifyEmailInput } from "../types/user.types.js";
import { createEmailVerificationToken, readEmailVerificationToken } from "../utils/emailVerificationToken.js";
import { isEmailDeliveryConfigured, sendVerificationEmail } from "./email.service.js";

const RESEND_COOLDOWN_MS = 60_000;
const RESEND_GENERIC_MESSAGE =
  "Se houver um cadastro pendente para esse e-mail, enviaremos uma nova mensagem se necessário. Se você solicitou uma confirmação recentemente, aguarde um minuto.";

function splitFullName(fullName: string): { nome: string; sobrenome: string | null } {
  const [nome, ...rest] = fullName.trim().split(/\s+/);
  return { nome: nome ?? fullName.trim(), sobrenome: rest.length > 0 ? rest.join(" ") : null };
}

export function toUserResponse(user: {
  id_usuario: number;
  nome: string;
  sobrenome: string | null;
  email: string;
}): UserResponse {
  return {
    id_usuario: user.id_usuario,
    nome: user.nome,
    sobrenome: user.sobrenome,
    email: user.email,
  };
}

export const userService = {
  async register(input: RegisterUserInput): Promise<{ email: string; message: string }> {
    if (!isEmailDeliveryConfigured()) {
      throw new AppError(
        "O cadastro por e-mail está temporariamente indisponível: falta configurar o envio de e-mails no servidor.",
        503
      );
    }

    const existingUser = await userRepository.findByEmail(input.email);

    if (existingUser) {
      if (existingUser.email_verificado === true) {
        throw new AppError("E-mail já cadastrado.", 409);
      }

      const lastUpdate = existingUser.updated_at ?? existingUser.created_at;
      if (!lastUpdate || Date.now() - lastUpdate.getTime() >= RESEND_COOLDOWN_MS) {
        const token = createEmailVerificationToken(existingUser.id_usuario);
        await sendVerificationEmail(existingUser.email, token);
        await userRepository.touchUpdatedAt(existingUser.id_usuario);
      }

      return {
        email: existingUser.email,
        message: "Já existe um cadastro pendente para este e-mail. Um link de confirmação foi enviado à sua caixa de entrada.",
      };
    }

    const { nome, sobrenome } = splitFullName(input.fullName);
    const senhaHash = await hashPassword(input.password);

    const user = await userRepository.create({
      nome,
      sobrenome,
      email: input.email,
      senha: senhaHash,
    });

    try {
      const token = createEmailVerificationToken(user.id_usuario);
      await sendVerificationEmail(user.email, token);
    } catch (error) {
      try {
        await userRepository.deleteById(user.id_usuario);
      } catch (cleanupError) {
        console.error("Não foi possível remover um cadastro que ficou sem e-mail de confirmação.", cleanupError);
      }

      if (error instanceof AppError) throw error;
      console.error("Falha ao enviar e-mail de confirmação.", error);
      throw new AppError("Não foi possível enviar o e-mail de confirmação. Tente novamente mais tarde.", 502);
    }

    return {
      email: user.email,
      message: "Cadastro iniciado. Confira sua caixa de entrada e confirme o e-mail antes de entrar.",
    };
  },

  async verifyEmail(input: VerifyEmailInput): Promise<{ message: string }> {
    const userId = readEmailVerificationToken(input.token);
    const user = await userRepository.findById(userId);

    if (!user) {
      throw new AppError("O cadastro associado a este link não foi encontrado.", 404);
    }

    if (user.email_verificado === true) {
      return { message: "Este e-mail já foi confirmado. Você já pode entrar na sua conta." };
    }

    await userRepository.markEmailVerified(userId);
    return { message: "E-mail confirmado com sucesso! Agora você já pode entrar no Cifra Wealth." };
  },

  async resendVerification(input: ResendVerificationInput): Promise<{ message: string }> {
    if (!isEmailDeliveryConfigured()) {
      throw new AppError("O serviço de e-mail está temporariamente indisponível.", 503);
    }

    const user = await userRepository.findByEmail(input.email);
    if (!user || user.email_verificado === true || user.google_id || !user.senha) {
      return { message: RESEND_GENERIC_MESSAGE };
    }

    const lastUpdate = user.updated_at ?? user.created_at;
    if (lastUpdate && Date.now() - lastUpdate.getTime() < RESEND_COOLDOWN_MS) {
      return { message: RESEND_GENERIC_MESSAGE };
    }

    const token = createEmailVerificationToken(user.id_usuario);
    await sendVerificationEmail(user.email, token);
    await userRepository.touchUpdatedAt(user.id_usuario);

    return { message: RESEND_GENERIC_MESSAGE };
  },
};