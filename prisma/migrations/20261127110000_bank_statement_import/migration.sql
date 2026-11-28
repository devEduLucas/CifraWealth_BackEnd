ALTER TABLE `transacoes`
  ADD COLUMN `import_fingerprint` CHAR(64) NULL;

CREATE UNIQUE INDEX `uq_transacao_import_fingerprint`
  ON `transacoes` (`id_usuario`, `import_fingerprint`);
