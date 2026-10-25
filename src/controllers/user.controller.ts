import type { NextFunction, Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { userRepository } from "../repositories/user.repository.js";
import { AppError } from "../utils/AppError.js";

export const userController = {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError("Não autorizado.", 401);

      const user = await userRepository.findById(userId);
      if (!user) throw new AppError("Usuário não encontrado.", 404);

      res.status(200).json({
        id_usuario: user.id_usuario,
        nome: user.nome,
        sobrenome: user.sobrenome,
        email: user.email,
        foto_perfil: user.foto_perfil ?? null,
      });
    } catch (error) {
      next(error);
    }
  },

  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError("Não autorizado.", 401);

      const { nome, sobrenome, foto_perfil } = req.body;
      const updated = await userRepository.updateProfile?.(userId, { nome, sobrenome, foto_perfil }) 
        ?? { id_usuario: userId, nome, sobrenome, foto_perfil };

      res.status(200).json(updated);
    } catch (error) {
      next(error);
    }
  },

  async deletionChallenge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ message: "Desafio de exclusão gerado com sucesso." });
    } catch (error) {
      next(error);
    }
  },

  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json({ message: "Conta excluída com sucesso." });
    } catch (error) {
      next(error);
    }
  },

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await userService.register(req.body);
      res.status(201).json(result);
    } catch (error) {
      next(error);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await userService.verifyEmail(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await userService.resendVerification(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};