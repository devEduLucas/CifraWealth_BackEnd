import { app } from "./app.js";
import { env } from "./config/env.js";
import { isBrevoDeliveryConfigured } from "./services/email.service.js";

app.listen(env.PORT, () => {
  console.log(`Servidor rodando na porta ${env.PORT} [${env.NODE_ENV}]`);
  if (env.NODE_ENV === "development" && !isBrevoDeliveryConfigured()) {
    console.warn(
      "Aviso: Chave da Brevo (BREVO_API_KEY) não configurada no .env. Em modo desenvolvimento, os links de ativação serão exibidos no console."
    );
  }
});
