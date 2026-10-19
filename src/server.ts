import { app } from "./app.js";
import { env } from "./config/env.js";
import { isBrevoDeliveryConfigured } from "./services/email.service.js";

app.listen(env.PORT, () => {
  console.log(`Servidor rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
  if (env.NODE_ENV === "development" && !isBrevoDeliveryConfigured()) {
    console.warn(
      "Cadastro e recuperação por e-mail indisponíveis: configure BREVO_API_KEY, BREVO_SENDER_EMAIL, FRONTEND_URL e EMAIL_VERIFICATION_SECRET no .env. Veja o README."
    );
  }
});
