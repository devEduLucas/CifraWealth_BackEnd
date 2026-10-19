import { Router } from "express";
import { financialGoalController } from "../controllers/financialGoal.controller.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  contributeGoalSchema,
  createGoalSchema,
  updateGoalSchema,
} from "../types/financialGoal.types.js";

export const financialGoalRoutes = Router();

financialGoalRoutes.use(authMiddleware);

financialGoalRoutes.get("/", financialGoalController.list);
financialGoalRoutes.get("/:id", financialGoalController.getById);
financialGoalRoutes.post("/", validate(createGoalSchema), financialGoalController.create);
financialGoalRoutes.put("/:id", validate(updateGoalSchema), financialGoalController.update);
financialGoalRoutes.post(
  "/:id/contribute",
  validate(contributeGoalSchema),
  financialGoalController.contribute
);
financialGoalRoutes.delete("/:id", financialGoalController.remove);
financialGoalRoutes.post("/:id/withdraw", validate(contributeGoalSchema), financialGoalController.withdraw);
