-- Store the resized avatar in the account; request validation caps it at 200 KB.
ALTER TABLE `usuarios` MODIFY `foto_perfil` MEDIUMTEXT NULL;
ALTER TABLE `usuarios` ADD COLUMN `capa_perfil` MEDIUMTEXT NULL;
