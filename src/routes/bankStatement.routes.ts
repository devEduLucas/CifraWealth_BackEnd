import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { bankStatementController } from "../controllers/bankStatement.controller.js";

export const bankStatementRoutes = Router();
bankStatementRoutes.use(authMiddleware);
bankStatementRoutes.post("/import", bankStatementController.import);
