-- CifraWealth - banco de dados para instalação do zero.
-- ATENÇÃO: execute apenas em um banco novo. Este script não apaga bancos existentes.
-- O nome smartfinance_db foi mantido para corresponder ao DATABASE_URL do .env.example atual.

CREATE DATABASE IF NOT EXISTS smartfinance_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE smartfinance_db;

CREATE TABLE usuarios (
  id_usuario INT AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(50) NOT NULL,
  sobrenome VARCHAR(50) NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  senha VARCHAR(255) NULL,
  google_id VARCHAR(255) NULL UNIQUE,
  foto_perfil VARCHAR(255) NULL,
  email_verificado BOOLEAN DEFAULT FALSE,
  ultimo_login DATETIME NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE categorias (
  id_categoria INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  nome VARCHAR(50) NOT NULL,
  tipo ENUM('receita', 'despesa') NOT NULL,
  icone VARCHAR(50) NULL,
  cor VARCHAR(20) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_categorias_usuario (id_usuario),
  CONSTRAINT categorias_id_usuario_fkey
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE transacoes (
  id_transacao INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  id_categoria INT NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  tipo ENUM('receita', 'despesa') NOT NULL,
  descricao VARCHAR(200) NOT NULL,
  data_transacao DATE NOT NULL,
  status ENUM('confirmada', 'pendente') DEFAULT 'confirmada',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_transacoes_usuario (id_usuario),
  INDEX idx_transacoes_categoria (id_categoria),
  INDEX idx_transacoes_data (data_transacao),
  CONSTRAINT fk_categoria
    FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT transacoes_ibfk_2
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

CREATE TABLE metas_financeiras (
  id_meta INT AUTO_INCREMENT PRIMARY KEY,
  id_usuario INT NOT NULL,
  titulo VARCHAR(100) NOT NULL,
  descricao VARCHAR(255) NULL,
  valor_objetivo DECIMAL(10,2) NOT NULL,
  valor_atual DECIMAL(10,2) DEFAULT 0.00,
  status ENUM('em_andamento', 'concluida', 'cancelada') DEFAULT 'em_andamento',
  data_inicio DATE NULL,
  data_fim DATE NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_metas_usuario (id_usuario),
  CONSTRAINT metas_financeiras_ibfk_1
    FOREIGN KEY (id_usuario) REFERENCES usuarios(id_usuario)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB;

-- Usuários fictícios para testes. Substitua os hashes por senhas válidas geradas pela aplicação.
INSERT INTO usuarios (id_usuario, nome, sobrenome, email, senha) VALUES
  (1, 'Matheus', 'Silva', 'matheus@gmail.com', '$2b$12$senha_hash_exemplo'),
  (2, 'Eduardo', 'Souza', 'eduardo@gmail.com', '$2b$12$senha_hash_exemplo'),
  (3, 'Renato', 'Lima', 'renato@gmail.com', '$2b$12$senha_hash_exemplo');

-- Cada usuário recebe sua própria cópia das categorias padrão.
INSERT INTO categorias (id_categoria, id_usuario, nome, tipo, icone, cor) VALUES
  (1, 1, 'Salário', 'receita', 'wallet', '#22C55E'),
  (2, 1, 'Freelance', 'receita', 'briefcase', '#10B981'),
  (3, 1, 'Investimentos', 'receita', 'chart-line', '#059669'),
  (4, 1, 'Alimentação', 'despesa', 'utensils', '#F97316'),
  (5, 1, 'Transporte', 'despesa', 'car', '#3B82F6'),
  (6, 1, 'Lazer', 'despesa', 'gamepad', '#A855F7'),
  (7, 2, 'Salário', 'receita', 'wallet', '#22C55E'),
  (8, 2, 'Freelance', 'receita', 'briefcase', '#10B981'),
  (9, 2, 'Investimentos', 'receita', 'chart-line', '#059669'),
  (10, 2, 'Alimentação', 'despesa', 'utensils', '#F97316'),
  (11, 2, 'Transporte', 'despesa', 'car', '#3B82F6'),
  (12, 2, 'Lazer', 'despesa', 'gamepad', '#A855F7'),
  (13, 3, 'Salário', 'receita', 'wallet', '#22C55E'),
  (14, 3, 'Freelance', 'receita', 'briefcase', '#10B981'),
  (15, 3, 'Investimentos', 'receita', 'chart-line', '#059669'),
  (16, 3, 'Alimentação', 'despesa', 'utensils', '#F97316'),
  (17, 3, 'Transporte', 'despesa', 'car', '#3B82F6'),
  (18, 3, 'Lazer', 'despesa', 'gamepad', '#A855F7');

INSERT INTO transacoes
  (id_usuario, id_categoria, valor, tipo, descricao, data_transacao, status)
VALUES
  (1, 1, 3500.00, 'receita', 'Salário de Maio', '2026-05-05', 'confirmada'),
  (2, 10, 250.00, 'despesa', 'Mercado', '2026-05-10', 'confirmada'),
  (3, 17, 120.00, 'despesa', 'Combustível', '2026-05-12', 'confirmada'),
  (2, 8, 800.00, 'receita', 'Projeto Freelancer', '2026-05-08', 'confirmada'),
  (2, 12, 50.00, 'despesa', 'Cinema', '2026-05-15', 'confirmada'),
  (3, 13, 4200.00, 'receita', 'Salário de Maio', '2026-05-05', 'confirmada'),
  (3, 16, 180.00, 'despesa', 'Restaurante', '2026-05-11', 'confirmada'),
  (3, 15, 500.00, 'receita', 'Aplicação em CDB', '2026-05-20', 'confirmada');

INSERT INTO metas_financeiras
  (id_usuario, titulo, descricao, valor_objetivo, valor_atual, data_inicio, data_fim)
VALUES
  (1, 'Viagem para o Japão', 'Guardar dinheiro para a viagem.', 15000.00, 4500.00, '2026-01-01', '2026-12-31'),
  (2, 'Notebook Novo', 'Comprar um notebook para desenvolvimento.', 7000.00, 2800.00, '2026-02-01', '2026-10-30'),
  (3, 'Reserva de Emergência', 'Construir uma reserva equivalente a seis meses de despesas.', 10000.00, 6200.00, '2026-01-15', '2026-12-31');
