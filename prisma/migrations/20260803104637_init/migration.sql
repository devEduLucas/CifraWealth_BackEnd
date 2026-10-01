-- CreateTable
CREATE TABLE `categorias` (
    `id_categoria` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(50) NOT NULL,
    `tipo` ENUM('receita', 'despesa') NOT NULL,
    `icone` VARCHAR(50) NULL,
    `cor` VARCHAR(20) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id_categoria`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `metas_financeiras` (
    `id_meta` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NOT NULL,
    `titulo` VARCHAR(100) NOT NULL,
    `descricao` VARCHAR(255) NULL,
    `valor_objetivo` DECIMAL(10, 2) NOT NULL,
    `valor_atual` DECIMAL(10, 2) NULL DEFAULT 0.00,
    `status` ENUM('em_andamento', 'concluida', 'cancelada') NULL DEFAULT 'em_andamento',
    `data_inicio` DATE NULL,
    `data_fim` DATE NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_metas_usuario`(`id_usuario`),
    PRIMARY KEY (`id_meta`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transacoes` (
    `id_transacao` INTEGER NOT NULL AUTO_INCREMENT,
    `id_usuario` INTEGER NOT NULL,
    `id_categoria` INTEGER NOT NULL,
    `valor` DECIMAL(10, 2) NOT NULL,
    `tipo` ENUM('receita', 'despesa') NOT NULL,
    `descricao` VARCHAR(200) NOT NULL,
    `data_transacao` DATE NOT NULL,
    `status` ENUM('confirmada', 'pendente') NULL DEFAULT 'confirmada',
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `idx_transacoes_categoria`(`id_categoria`),
    INDEX `idx_transacoes_data`(`data_transacao`),
    INDEX `idx_transacoes_usuario`(`id_usuario`),
    PRIMARY KEY (`id_transacao`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usuarios` (
    `id_usuario` INTEGER NOT NULL AUTO_INCREMENT,
    `nome` VARCHAR(50) NOT NULL,
    `sobrenome` VARCHAR(50) NULL,
    `email` VARCHAR(150) NOT NULL,
    `senha` VARCHAR(255) NULL,
    `google_id` VARCHAR(255) NULL,
    `foto_perfil` VARCHAR(255) NULL,
    `email_verificado` BOOLEAN NULL DEFAULT false,
    `ultimo_login` DATETIME(0) NULL,
    `created_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),
    `updated_at` TIMESTAMP(0) NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `email`(`email`),
    UNIQUE INDEX `google_id`(`google_id`),
    PRIMARY KEY (`id_usuario`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `metas_financeiras` ADD CONSTRAINT `metas_financeiras_ibfk_1` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacoes` ADD CONSTRAINT `fk_categoria` FOREIGN KEY (`id_categoria`) REFERENCES `categorias`(`id_categoria`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transacoes` ADD CONSTRAINT `transacoes_ibfk_2` FOREIGN KEY (`id_usuario`) REFERENCES `usuarios`(`id_usuario`) ON DELETE CASCADE ON UPDATE CASCADE;
