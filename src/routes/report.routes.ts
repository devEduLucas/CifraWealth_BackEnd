import { Router } from "express";
import { reportController } from "../controllers/report.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";

export const reportRoutes = Router();

reportRoutes.use(authMiddleware);

reportRoutes.get("/monthly", reportController.monthly);

reportRoutes.get("/detailed", reportController.detailed);
