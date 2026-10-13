import { prisma } from "../lib/prisma.js";
import type { usuarios } from "../generated/prisma/client.js";
import { DEFAULT_CATEGORIES } from "../utils/defaultCategories.js";

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

  markEmailVerified(userId: number): Promise<usuarios> {
    return prisma.usuarios.update({
      where: { id_usuario: userId },
      data: { email_verificado: true },
    });
  },

  deleteById(userId: number): Promise<usuarios> {
    return prisma.usuarios.delete({ where: { id_usuario: userId } });
  },

  touchUpdatedAt(userId: number): Promise<usuarios> {
    return prisma.usuarios.update({
      where: { id_usuario: userId },
      data: { updated_at: new Date() },
    });
  },
};