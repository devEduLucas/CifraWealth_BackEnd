import type { NextFunction, Request, Response } from "express";
import { authService } from "../services/auth.service.js";

export const authController = {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.login(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async google(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.google(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.forgotPassword(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },

  async resetPassword(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.resetPassword(req.body);
      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  },
};