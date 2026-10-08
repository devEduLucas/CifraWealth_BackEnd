import type { NextFunction, Request, Response } from "express";
import { categoryService } from "../services/category.service.js";
import { parseIdParam } from "../utils/parseIdParam.js";
import { AppError } from "../utils/AppError.js";

function getUserId(req: Request): number {
  if (!req.userId) {
    throw new AppError("Não autenticado.", 401);
  }
  return req.userId;
}

export const categoryController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(200).json(await categoryService.list(getUserId(req)));
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.getById(parseIdParam(req), getUserId(req));
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.create(getUserId(req), req.body);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.update(parseIdParam(req), getUserId(req), req.body);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      await categoryService.remove(parseIdParam(req), getUserId(req));
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
