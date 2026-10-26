CREATE TABLE livros (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  titulo VARCHAR(255) NOT NULL,
  autor VARCHAR(255) NOT NULL,
  isbn VARCHAR(13) NULL,
  categoria VARCHAR(100) NULL,
  ano_publicacao SMALLINT UNSIGNED NULL,
  quantidade_total INT UNSIGNED NOT NULL,
  quantidade_manutencao INT UNSIGNED NOT NULL DEFAULT 0,
  estante VARCHAR(60) NULL,
  prateleira VARCHAR(60) NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_livros_isbn UNIQUE (isbn),
  CONSTRAINT ck_livros_quantidades CHECK (quantidade_total >= 1 AND quantidade_manutencao <= quantidade_total),
  INDEX idx_livros_ativo_titulo (ativo, titulo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
