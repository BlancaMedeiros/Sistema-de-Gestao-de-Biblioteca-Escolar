ALTER TABLE livros
  ADD COLUMN isbn_ativo VARCHAR(13) AS (IF(ativo = 1, isbn, NULL)) VIRTUAL;
