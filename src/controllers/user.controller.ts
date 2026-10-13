import type { NextFunction, Request, Response } from "express";
import { userService } from "../services/user.service.js";

export const userController = {
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
