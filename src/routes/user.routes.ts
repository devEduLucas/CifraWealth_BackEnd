import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import {
  deleteAccountSchema,
  registerUserSchema,
  resendVerificationSchema,
  updateProfileSchema,
  verifyEmailSchema,
} from "../types/user.types.js";
import { authMiddleware } from "../middlewares/auth.middleware.js";
import rateLimit from "express-rate-limit";

export const userRoutes = Router();

const deletionLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    message: "Muitas tentativas de confirmação. Aguarde alguns minutos antes de tentar novamente.",
  },
});

// Rotas de perfil e conta (100% preservadas)
userRoutes.get("/me", authMiddleware, userController.getProfile);
userRoutes.patch("/me", authMiddleware, validate(updateProfileSchema), userController.updateProfile);
userRoutes.post("/me/deletion-challenge", authMiddleware, deletionLimiter, userController.deletionChallenge);
userRoutes.delete("/me", authMiddleware, deletionLimiter, validate(deleteAccountSchema), userController.deleteAccount);

// Rotas de autenticação e verificação
userRoutes.post("/register", validate(registerUserSchema), userController.register);
userRoutes.post("/verify-email", validate(verifyEmailSchema), userController.verifyEmail);
userRoutes.post("/resend-verification", validate(resendVerificationSchema), userController.resendVerification);