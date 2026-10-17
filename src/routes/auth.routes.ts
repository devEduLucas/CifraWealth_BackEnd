import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import { googleLoginSchema, loginUserSchema, forgotPasswordSchema, resetPasswordSchema } from "../types/user.types.js";

export const authRoutes = Router();

authRoutes.post("/login", validate(loginUserSchema), authController.login);
authRoutes.post("/google", validate(googleLoginSchema), authController.google);
authRoutes.post("/forgot-password", validate(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post("/reset-password", validate(resetPasswordSchema), authController.resetPassword);