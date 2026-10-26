ALTER TABLE livros
  ADD CONSTRAINT uq_livros_isbn_ativo UNIQUE (isbn_ativo);
