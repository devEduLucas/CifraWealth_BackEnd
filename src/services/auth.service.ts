import { OAuth2Client } from "google-auth-library";
import { userRepository } from "../repositories/user.repository.js";
import { toUserResponse } from "./user.service.js";
import { AppError } from "../utils/AppError.js";
import { comparePassword } from "../utils/hashPassword.js";
import { signToken } from "../utils/jwt.js";
import { env } from "../config/env.js";
import type { AuthResponse, GoogleLoginInput, LoginUserInput } from "../types/user.types.js";

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

    const token = signToken({ userId: user.id_usuario });

    return { user: toUserResponse(user), token };
  },

  async google(input: GoogleLoginInput): Promise<AuthResponse> {
    if (!env.GOOGLE_CLIENT_ID) {
      throw new AppError("Login com Google não está configurado.", 503);
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: input.idToken,
      audience: env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();

    if (!payload?.email) {
      throw new AppError("Token do Google inválido.", 401);
    }

    const googleId = payload.sub;
    let user = await userRepository.findByGoogleId(googleId);

    if (!user) {
      const existingByEmail = await userRepository.findByEmail(payload.email);

      if (existingByEmail) {
        user = await userRepository.linkGoogleId(existingByEmail.id_usuario, googleId);
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

    const token = signToken({ userId: user.id_usuario });

    return { user: toUserResponse(user), token };
  },
};