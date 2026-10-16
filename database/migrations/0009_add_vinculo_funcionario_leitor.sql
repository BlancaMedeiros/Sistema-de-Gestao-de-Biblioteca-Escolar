ALTER TABLE funcionarios
  ADD CONSTRAINT uq_funcionarios_usuario UNIQUE (usuario_id),
  ADD CONSTRAINT fk_funcionarios_usuario FOREIGN KEY (usuario_id) REFERENCES usuarios(id);
