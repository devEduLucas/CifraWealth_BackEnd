import type { NextFunction, Request, Response } from "express";
import { financialGoalService } from "../services/financialGoal.service.js";
import { parseIdParam } from "../utils/parseIdParam.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): number {
  if (!req.userId) {
    throw new AppError("Não autenticado.", 401);
  }
  return req.userId;
}

export const financialGoalController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const goals = await financialGoalService.list(userId);
      res.status(200).json(goals);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      const goal = await financialGoalService.getById(id, userId);
      res.status(200).json(goal);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const goal = await financialGoalService.create(userId, req.body);
      res.status(201).json(goal);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      const goal = await financialGoalService.update(id, userId, req.body);
      res.status(200).json(goal);
    } catch (error) {
      next(error);
    }
  },

  async contribute(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      const goal = await financialGoalService.contribute(id, userId, req.body);
      res.status(200).json(goal);
    } catch (error) {
      next(error);
    }
  },

  async withdraw(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await financialGoalService.withdraw(parseIdParam(req), getUserId(req), req.body));
    } catch (error) { next(error); }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      await financialGoalService.remove(id, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
