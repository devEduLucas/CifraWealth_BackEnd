-- Contas existentes antes da ativação da confirmação por e-mail continuam funcionando.
-- Somente cadastros novos passarão a aguardar a confirmação enviada por e-mail.
UPDATE `usuarios`
SET `email_verificado` = TRUE
WHERE `email_verificado` IS NULL OR `email_verificado` = FALSE;
