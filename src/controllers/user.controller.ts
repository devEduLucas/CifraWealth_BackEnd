import type { NextFunction, Request, Response } from "express";
import { userService } from "../services/user.service.js";
import { profileService } from '../services/profile.service.js';

export const userController = {
  async getProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(200).json(await profileService.get(req.userId!)); } catch (error) { next(error); }
  },
  async updateProfile(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(200).json(await profileService.update(req.userId!, req.body)); } catch (error) { next(error); }
  },
  async deletionChallenge(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(200).json(await profileService.deletionChallenge(req.userId!)); } catch (error) { next(error); }
  },
  async deleteAccount(req: Request, res: Response, next: NextFunction): Promise<void> {
    try { res.status(200).json(await profileService.delete(req.userId!, req.body)); } catch (error) { next(error); }
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
