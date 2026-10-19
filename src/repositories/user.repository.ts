import { prisma } from "../lib/prisma.js";
import type { usuarios } from "../generated/prisma/client.js";
import { DEFAULT_CATEGORIES } from "../utils/defaultCategories.js";
import { AppError } from "../utils/AppError.js";

export interface CreateUserData {
  nome: string;
  sobrenome: string | null;
  email: string;
  senha: string;
}

export interface CreateGoogleUserData {
  nome: string;
  sobrenome: string | null;
  email: string;
  google_id: string;
  foto_perfil: string | null;
}

export const userRepository = {
  findByEmail(email: string): Promise<usuarios | null> {
    return prisma.usuarios.findUnique({ where: { email } });
  },

  findById(userId: number): Promise<usuarios | null> {
    return prisma.usuarios.findUnique({ where: { id_usuario: userId } });
  },

  findByGoogleId(googleId: string): Promise<usuarios | null> {
    return prisma.usuarios.findUnique({ where: { google_id: googleId } });
  },

  create(data: CreateUserData): Promise<usuarios> {
    return prisma.usuarios.create({
      data: { ...data, email_verificado: false, categorias: { create: DEFAULT_CATEGORIES } },
    });
  },

  createWithGoogle(data: CreateGoogleUserData): Promise<usuarios> {
    return prisma.usuarios.create({
      data: { ...data, email_verificado: true, categorias: { create: DEFAULT_CATEGORIES } },
    });
  },

  linkGoogleId(userId: number, googleId: string, resetPassword = false): Promise<usuarios> {
    return prisma.usuarios.update({
      where: { id_usuario: userId },
      data: {
        google_id: googleId,
        email_verificado: true,
        ...(resetPassword ? { senha: null } : {}),
      },
    });
  },

  updateLastLogin(userId: number): Promise<usuarios> {
    return prisma.usuarios.update({
      where: { id_usuario: userId },
      data: { ultimo_login: new Date() },
    });
  },

  markEmailVerified(userId: number, passwordHash: string) {
    return prisma.usuarios.updateMany({
      where: { id_usuario: userId, senha: passwordHash, email_verificado: false, google_id: null },
      data: { email_verificado: true },
    });
  },

  replacePendingRegistration(current: usuarios, data: CreateUserData): Promise<usuarios> {
    return prisma.$transaction(async (tx) => {
      const changed = await tx.usuarios.updateMany({
        where: { id_usuario: current.id_usuario, senha: current.senha, updated_at: current.updated_at, email_verificado: false, google_id: null },
        data,
      });
      if (changed.count !== 1) throw new AppError("O cadastro foi atualizado. Tente entrar ou solicite outro link de confirmação.", 409);
      return tx.usuarios.findUniqueOrThrow({ where: { id_usuario: current.id_usuario } });
    });
  },

  deletePendingRegistration(userId: number, passwordHash: string) {
    return prisma.usuarios.deleteMany({ where: { id_usuario: userId, senha: passwordHash, email_verificado: false, google_id: null } });
  },

  touchUpdatedAt(userId: number, passwordHash: string) {
    return prisma.usuarios.updateMany({
      where: { id_usuario: userId, senha: passwordHash, email_verificado: false, google_id: null },
      data: { updated_at: new Date() },
    });
  },

  updatePasswordIfCurrent(current: usuarios, passwordHash: string) {
    return prisma.usuarios.updateMany({
      where: { id_usuario: current.id_usuario, senha: current.senha, email: current.email, google_id: current.google_id },
      data: { senha: passwordHash, email_verificado: true },
    });
  },
};

