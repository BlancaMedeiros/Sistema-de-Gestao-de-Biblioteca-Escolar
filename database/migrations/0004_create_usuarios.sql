CREATE TABLE usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nome VARCHAR(160) NOT NULL,
  matricula VARCHAR(60) NOT NULL,
  email VARCHAR(254) NULL,
  telefone VARCHAR(30) NULL,
  turma VARCHAR(100) NULL,
  tipo ENUM('Aluno', 'Professor', 'Bibliotecário') NOT NULL,
  ativo TINYINT(1) NOT NULL DEFAULT 1,
  data_cadastro DATE NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  atualizado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT uq_usuarios_matricula UNIQUE (matricula),
  INDEX idx_usuarios_ativo_nome (ativo, nome)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
