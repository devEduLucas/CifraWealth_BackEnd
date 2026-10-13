import { Router } from "express";
import { userController } from "../controllers/user.controller.js";
import { validate } from "../middlewares/validation.middleware.js";
import { registerUserSchema, resendVerificationSchema, verifyEmailSchema } from "../types/user.types.js";

export const userRoutes = Router();

userRoutes.post("/register", validate(registerUserSchema), userController.register);
userRoutes.post("/verify-email", validate(verifyEmailSchema), userController.verifyEmail);
userRoutes.post("/resend-verification", validate(resendVerificationSchema), userController.resendVerification);
