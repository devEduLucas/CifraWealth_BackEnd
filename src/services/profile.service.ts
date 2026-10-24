import { OAuth2Client } from "google-auth-library";
import { userRepository } from "../repositories/user.repository.js";
import { toUserResponse } from "./user.service.js";
import { comparePassword } from "../utils/hashPassword.js";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";
import {
  createAccountDeletionChallenge,
  readAccountDeletionChallenge,
} from "../utils/accountDeletionToken.js";
import type {
  DeleteAccountInput,
  UpdateProfileInput,
} from "../types/user.types.js";

const googleClient = new OAuth2Client();

async function currentUser(userId: number) {
  const user = await userRepository.findById(userId);
  if (!user) throw new AppError("Conta não encontrada.", 404);
  return user;
}

export const profileService = {
  async get(userId: number) {
    return toUserResponse(await currentUser(userId));
  },

  async update(userId: number, input: UpdateProfileInput) {
    const [nome, ...rest] = input.fullName.split(/\s+/);
    return toUserResponse(
      await userRepository.updateProfile(userId, {
        nome: nome!,
        sobrenome: rest.join(" ") || null,
        ...(input.avatar !== undefined ? { foto_perfil: input.avatar } : {}),
        ...(input.cover !== undefined ? { capa_perfil: input.cover } : {}),
      }),
    );
  },

  async deletionChallenge(userId: number) {
    const user = await currentUser(userId);
    if (!user.google_id || !env.GOOGLE_CLIENT_ID)
      throw new AppError(
        "A confirmação com Google está indisponível. Se você cadastrou uma senha, use-a para confirmar.",
        503,
      );
    return createAccountDeletionChallenge(user);
  },

  async delete(userId: number, input: DeleteAccountInput) {
    const user = await currentUser(userId);
    if ("password" in input) {
      if (!user.senha || !(await comparePassword(input.password, user.senha)))
        throw new AppError(
          "Senha incorreta. Confira sua senha e tente novamente.",
          403,
        );
    } else {
      if (!user.google_id)
        throw new AppError(
          "Esta conta precisa ser confirmada com sua senha.",
          403,
        );
      if (!env.GOOGLE_CLIENT_ID)
        throw new AppError(
          "A confirmação com Google está temporariamente indisponível.",
          503,
        );
      const nonce = readAccountDeletionChallenge(input.challengeToken, user);
      let payload;
      try {
        const ticket = await googleClient.verifyIdToken({
          idToken: input.googleIdToken,
          audience: env.GOOGLE_CLIENT_ID,
        });
        payload = ticket.getPayload();
      } catch {
        throw new AppError(
          "Não foi possível confirmar sua conta Google. Tente novamente.",
          403,
        );
      }
      if (
        !payload ||
        payload.sub !== user.google_id ||
        payload.email_verified !== true ||
        (payload as typeof payload & { nonce?: string }).nonce !== nonce
      )
        throw new AppError(
          "Confirme com a mesma conta Google usada no CifraWealth.",
          403,
        );
    }
    await userRepository.deleteIfCurrent(user);
    return { message: "Conta e dados financeiros excluídos com sucesso." };
  },
};
