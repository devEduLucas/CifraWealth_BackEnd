-- Categorias passam a pertencer a um usuário (antes eram compartilhadas por todos).
-- A migração preserva os dados existentes.

-- 1) Nova coluna (temporariamente opcional)
ALTER TABLE `categorias` ADD COLUMN `id_usuario` INTEGER NULL;

-- 2) Cada usuário que já usou uma categoria compartilhada ganha uma cópia própria dela
INSERT INTO `categorias` (`nome`, `tipo`, `icone`, `cor`, `id_usuario`)
SELECT DISTINCT c.`nome`, c.`tipo`, c.`icone`, c.`cor`, t.`id_usuario`
FROM `categorias` c
JOIN `transacoes` t ON t.`id_categoria` = c.`id_categoria`
WHERE c.`id_usuario` IS NULL;

-- 3) Aponta as transações para a cópia do próprio usuário
UPDATE `transacoes` t
JOIN `categorias` antiga ON antiga.`id_categoria` = t.`id_categoria` AND antiga.`id_usuario` IS NULL
JOIN `categorias` nova ON nova.`id_usuario` = t.`id_usuario`
  AND nova.`nome` = antiga.`nome` AND nova.`tipo` = antiga.`tipo`
SET t.`id_categoria` = nova.`id_categoria`;

-- 4) Todo usuário existente continua enxergando as categorias que tinha
INSERT INTO `categorias` (`nome`, `tipo`, `icone`, `cor`, `id_usuario`)
SELECT c.`nome`, c.`tipo`, c.`icone`, c.`cor`, u.`id_usuario`
FROM `categorias` c
CROSS JOIN `usuarios` u
WHERE c.`id_usuario` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `categorias` x
    WHERE x.`id_usuario` = u.`id_usuario` AND x.`nome` = c.`nome` AND x.`tipo` = c.`tipo`
  );

-- 5) Remove as categorias compartilhadas antigas (nenhuma transação aponta mais para elas)
DELETE FROM `categorias` WHERE `id_usuario` IS NULL;

-- 6) Torna obrigatório e cria a chave estrangeira (o MySQL cria o índice automaticamente)
ALTER TABLE `categorias` MODIFY `id_usuario` INTEGER NOT NULL;

ALTER TABLE `categorias` ADD CONSTRAINT `fk_categoria_usuario`
  FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
