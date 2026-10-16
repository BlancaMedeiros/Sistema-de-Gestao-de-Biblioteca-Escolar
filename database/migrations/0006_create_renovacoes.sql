CREATE TABLE renovacoes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  emprestimo_id INT UNSIGNED NOT NULL,
  funcionario_id INT UNSIGNED NOT NULL,
  numero TINYINT UNSIGNED NOT NULL,
  prazo_anterior DATE NOT NULL,
  novo_prazo DATE NOT NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_renovacoes_emprestimo FOREIGN KEY (emprestimo_id) REFERENCES emprestimos(id),
  CONSTRAINT fk_renovacoes_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
  CONSTRAINT uq_renovacoes_numero UNIQUE (emprestimo_id, numero),
  CONSTRAINT ck_renovacoes_prazo CHECK (novo_prazo > prazo_anterior AND numero BETWEEN 1 AND 2)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
