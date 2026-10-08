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

  findByGoogleId(googleId: string): Promise<usuarios | null> {
    return prisma.usuarios.findUnique({ where: { google_id: googleId } });
  },

  create(data: CreateUserData): Promise<usuarios> {
    return prisma.usuarios.create({
      data: { ...data, categorias: { create: DEFAULT_CATEGORIES } },
    });
  },

  createWithGoogle(data: CreateGoogleUserData): Promise<usuarios> {
    return prisma.usuarios.create({
      data: { ...data, categorias: { create: DEFAULT_CATEGORIES } },
    });
  },

  linkGoogleId(userId: number, googleId: string): Promise<usuarios> {
    return prisma.usuarios.update({
      where: { id_usuario: userId },
      data: { google_id: googleId },
    });
  },
};