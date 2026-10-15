import cors from "cors";
import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { corsOptions } from "./config/cors.js";
import { errorMiddleware } from "./middlewares/error.middleware.js";
import { notFoundMiddleware } from "./middlewares/notFound.middleware.js";
import { router } from "./routes/index.js";

export const app = express();

app.use(
  helmet({
    crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  })
);
app.use(cors(corsOptions));
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Rate limiters for authentication and email sending
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // 30 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Por favor, aguarde alguns minutos antes de tentar novamente." },
});

const resendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 requests per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Limite de solicitações de e-mail atingido. Tente novamente mais tarde." },
});

app.use("/api/auth/login", authLimiter);
app.use("/api/users/register", authLimiter);
app.use("/api/users/verify-email", authLimiter);
app.use("/api/users/resend-verification", resendLimiter);

app.use("/api", router);

app.use(notFoundMiddleware);
app.use(errorMiddleware);

