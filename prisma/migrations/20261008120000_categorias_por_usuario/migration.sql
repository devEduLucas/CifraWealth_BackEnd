-- Converte as categorias compartilhadas em categorias próprias de cada usuário.
-- A coluna id_usuario, o índice e a chave estrangeira são criados pela migration
-- 20261006120000_category_ownership; aqui apenas migramos os dados existentes.

-- 1) Cada usuário que já usou uma categoria compartilhada ganha uma cópia própria.
INSERT INTO `categorias` (`nome`, `tipo`, `icone`, `cor`, `id_usuario`)
SELECT DISTINCT c.`nome`, c.`tipo`, c.`icone`, c.`cor`, t.`id_usuario`
FROM `categorias` c
JOIN `transacoes` t ON t.`id_categoria` = c.`id_categoria`
WHERE c.`id_usuario` IS NULL;

-- 2) Aponta as transações para a cópia do próprio usuário.
UPDATE `transacoes` t
JOIN `categorias` antiga ON antiga.`id_categoria` = t.`id_categoria` AND antiga.`id_usuario` IS NULL
JOIN `categorias` nova ON nova.`id_usuario` = t.`id_usuario`
  AND nova.`nome` = antiga.`nome` AND nova.`tipo` = antiga.`tipo`
SET t.`id_categoria` = nova.`id_categoria`;

-- 3) Garante que todo usuário existente tenha cópias das categorias padrão.
INSERT INTO `categorias` (`nome`, `tipo`, `icone`, `cor`, `id_usuario`)
SELECT c.`nome`, c.`tipo`, c.`icone`, c.`cor`, u.`id_usuario`
FROM `categorias` c
CROSS JOIN `usuarios` u
WHERE c.`id_usuario` IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM `categorias` x
    WHERE x.`id_usuario` = u.`id_usuario` AND x.`nome` = c.`nome` AND x.`tipo` = c.`tipo`
  );

-- 4) Remove as categorias compartilhadas antigas após migrar suas transações.
DELETE FROM `categorias` WHERE `id_usuario` IS NULL;

-- 5) Torna obrigatório o vínculo entre categoria e usuário.
ALTER TABLE `categorias` MODIFY `id_usuario` INTEGER NOT NULL;
