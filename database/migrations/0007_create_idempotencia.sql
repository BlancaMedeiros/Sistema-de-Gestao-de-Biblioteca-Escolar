CREATE TABLE idempotencia (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  funcionario_id INT UNSIGNED NOT NULL,
  operacao VARCHAR(80) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  chave VARCHAR(100) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  hash_requisicao CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  http_status SMALLINT UNSIGNED NULL,
  resposta JSON NULL,
  criado_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_idempotencia_funcionario FOREIGN KEY (funcionario_id) REFERENCES funcionarios(id),
  CONSTRAINT uq_idempotencia_chave UNIQUE (funcionario_id, operacao, chave)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
