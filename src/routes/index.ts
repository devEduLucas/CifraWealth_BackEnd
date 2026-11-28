import { Router } from "express";
import { authRoutes } from "./auth.routes.js";
import { categoryRoutes } from "./category.routes.js";
import { dashboardRoutes } from "./dashboard.routes.js";
import { financialGoalRoutes } from "./financialGoal.routes.js";
import { reportRoutes } from "./report.routes.js";
import { transactionRoutes } from "./transaction.routes.js";
import { bankStatementRoutes } from "./bankStatement.routes.js";
import { userRoutes } from "./user.routes.js";

export const router = Router();

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

router.use("/users", userRoutes);
router.use("/auth", authRoutes);
router.use("/categories", categoryRoutes);
router.use("/transactions", transactionRoutes);
router.use("/bank-statements", bankStatementRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/goals", financialGoalRoutes);
router.use("/reports", reportRoutes);
