import type { NextFunction, Request, Response } from "express";
import { categoryService } from "../services/category.service.js";
import { parseIdParam } from "../utils/parseIdParam.js";

export const categoryController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categories = await categoryService.list(req.userId!);
      res.status(200).json(categories);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseIdParam(req);
      const category = await categoryService.getById(id, req.userId!);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const category = await categoryService.create(req.userId!, req.body);
      res.status(201).json(category);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseIdParam(req);
      const category = await categoryService.update(id, req.userId!, req.body);
      res.status(200).json(category);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = parseIdParam(req);
      await categoryService.remove(id, req.userId!);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
