import { app } from "./app.js";
import { env } from "./config/env.js";
import { isEmailDeliveryConfigured } from "./services/email.service.js";

app.listen(env.PORT, () => {
  console.log(`Servidor rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
  if (env.NODE_ENV === "development" && !isEmailDeliveryConfigured()) {
    console.warn("Cadastro por e-mail indisponível: preencha SMTP, FRONTEND_URL e EMAIL_VERIFICATION_SECRET no .env. Veja o README.");
  }
});
