import type { NextFunction, Request, Response } from "express";
import { transactionService } from "../services/transaction.service.js";
import { listTransactionsQuerySchema } from "../types/transaction.types.js";
import { parseIdParam } from "../utils/parseIdParam.js";
import { AppError } from "../utils/AppError.js";
import { transactionPageQuerySchema } from '../types/historyQuery.types.js';
import { historyQueryService } from '../services/historyQuery.service.js';

function getUserId(req: Request): number {
  if (!req.userId) {
    throw new AppError("Não autenticado.", 401);
  }
  return req.userId;
}

export const transactionController = {
  async list(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      if (req.query.view === 'page') {
        res.status(200).json(await historyQueryService.transactions(userId, transactionPageQuerySchema.parse(req.query)));
        return;
      }
      const query = listTransactionsQuerySchema.parse(req.query);
      const transactions = await transactionService.list(userId, query);
      res.status(200).json(transactions);
    } catch (error) {
      next(error);
    }
  },

  async getById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      const transaction = await transactionService.getById(id, userId);
      res.status(200).json(transaction);
    } catch (error) {
      next(error);
    }
  },

  async create(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const transaction = await transactionService.create(userId, req.body);
      res.status(201).json(transaction);
    } catch (error) {
      next(error);
    }
  },

  async update(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      const transaction = await transactionService.update(id, userId, req.body);
      res.status(200).json(transaction);
    } catch (error) {
      next(error);
    }
  },

  async remove(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = getUserId(req);
      const id = parseIdParam(req);
      await transactionService.remove(id, userId);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
};
