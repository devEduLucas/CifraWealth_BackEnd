import { OAuth2Client } from "google-auth-library";
import { userRepository } from "../repositories/user.repository.js";
import { toUserResponse } from "./user.service.js";
import { AppError } from "../utils/AppError.js";
import { comparePassword, hashPassword } from "../utils/hashPassword.js";
import { sessionVersion, signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import { createPasswordResetToken, matchesPasswordResetToken, readPasswordResetToken } from "../utils/PasswordResetToken.js";
import { isEmailDeliveryConfigured, sendPasswordResetEmail } from "./email.service.js";
import type { AuthResponse, ForgotPasswordInput, GoogleLoginInput, LoginUserInput, ResetPasswordInput } from "../types/user.types.js";

const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

function splitFullName(fullName: string): { nome: string; sobrenome: string | null } {
  const [nome, ...rest] = fullName.trim().split(/\s+/);
  const sobrenome = rest.length > 0 ? rest.join(" ") : null;
  return { nome: nome ?? fullName.trim(), sobrenome };
}

export const authService = {
  async login(input: LoginUserInput): Promise<AuthResponse> {
    const user = await userRepository.findByEmail(input.email);

    if (!user || !user.senha) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    const passwordMatches = await comparePassword(input.password, user.senha);

    if (!passwordMatches) {
      throw new AppError("E-mail ou senha inválidos.", 401);
    }

    if (user.email_verificado !== true) {
      throw new AppError("Confirme seu e-mail pelo link enviado à sua caixa de entrada antes de entrar.", 403);
    }

    await userRepository.updateLastLogin(user.id_usuario);

    const token = signToken({ userId: user.id_usuario, credentialVersion: sessionVersion(user) });

    return { user: toUserResponse(user), token };
  },

  async google(input: GoogleLoginInput): Promise<AuthResponse> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError("Login com Google não está configurado.", 503);
    }

    let ticket;
    try {
      ticket = await googleClient.verifyIdToken({
        idToken: input.idToken,
        audience: env.GOOGLE_CLIENT_ID,
      });
    } catch {
      throw new AppError("Token do Google inválido ou expirado.", 401);
    }

    const payload = ticket.getPayload();

    if (!payload?.email || payload.email_verified !== true) {
      throw new AppError("O Google precisa confirmar que este e-mail é seu para continuar.", 401);
    }

    const googleId = payload.sub;
    let user = await userRepository.findByGoogleId(googleId);

    if (!user) {
      const existingByEmail = await userRepository.findByEmail(payload.email);

      if (existingByEmail) {
        // If the account was not yet verified, wipe any pre-existing unverified password to prevent account takeover
        const isUnverified = existingByEmail.email_verificado !== true;
        user = await userRepository.linkGoogleId(existingByEmail.id_usuario, googleId, isUnverified);
      } else {
        const { nome, sobrenome } = splitFullName(payload.name ?? payload.email);
        user = await userRepository.createWithGoogle({
          nome,
          sobrenome,
          email: payload.email,
          google_id: googleId,
          foto_perfil: payload.picture ?? null,
        });
      }
    }

    await userRepository.updateLastLogin(user.id_usuario);

    const token = signToken({ userId: user.id_usuario, credentialVersion: sessionVersion(user) });

    return { user: toUserResponse(user), token };
  },

  async forgotPassword(input: ForgotPasswordInput): Promise<{ message: string }> {
    if (!isEmailDeliveryConfigured()) {
      throw new AppError("A recuperação de senha está temporariamente indisponível: falta configurar o envio de e-mails no servidor.", 503);
    }
    const genericResponse = {
      message: "Se o e-mail informado estiver cadastrado em nossa plataforma, você receberá as instruções de recuperação em instantes.",
    };

    const user = await userRepository.findByEmail(input.email);

    // Se o usuário não existe ou usa apenas login Google sem senha, retorna mensagem genérica (anti-enumeração)
    if (!user || (!user.senha && user.google_id)) {
      return genericResponse;
    }

    const token = createPasswordResetToken(user);
    await sendPasswordResetEmail(user.email, token);

    return genericResponse;
  },

  async resetPassword(input: ResetPasswordInput): Promise<{ message: string }> {
    const { userId, version } = readPasswordResetToken(input.token);

    const user = await userRepository.findById(userId);
    if (!user) {
      throw new AppError("Usuário não encontrado.", 404);
    }

    const isValidToken = matchesPasswordResetToken(version, user);
    if (!isValidToken) {
      throw new AppError("O link de redefinição é inválido ou já foi utilizado. Solicite um novo link se necessário.", 400);
    }

    const newPasswordHash = await hashPassword(input.password);
    const result = await userRepository.updatePasswordIfCurrent(user, newPasswordHash);
    if (result.count !== 1) {
      throw new AppError("O link de redefinição é inválido ou já foi utilizado. Solicite um novo link se necessário.", 400);
    }

    return { message: "Senha redefinida com sucesso! Você já pode entrar com sua nova senha." };
  },
};
