import { describe, expect, test } from 'vitest';

import { normalizarIsbn, paraLivroApi, type LivroRow } from './livro.js';

describe('normalizarIsbn', () => {
  test.each([
    ['978-85-359-0277-8', '9788535902778'],
    ['85 359 0277 x', '853590277X'],
    ['', null],
    ['   ', null],
    [null, null],
  ])('normaliza %s para %s', (entrada, esperado) => {
    expect(normalizarIsbn(entrada)).toBe(esperado);
  });
  test.each(['123', 'abc', '978abcdefghij', 'X123456789', '123456789012X', '978.8535902778'])(
    'recusa %s',
    (isbn) => {
      expect(() => normalizarIsbn(isbn)).toThrow();
    },
  );
});

describe('paraLivroApi', () => {
  test.each([
    [3, 1, 2, 0, 'Esgotado'],
    [5, 0, 1, 4, 'Disponível'],
  ])(
    'desconta empréstimos abertos do total %i',
    (total, manutencao, emprestados, disponivel, status) => {
      const livro = {
        id: 1,
        titulo: 'Livro',
        autor: 'Autora',
        isbn: null,
        categoria: null,
        ano_publicacao: null,
        quantidade_total: total,
        quantidade_manutencao: manutencao,
        quantidade_emprestada: emprestados,
        estante: null,
        prateleira: null,
      } as LivroRow;
      expect(paraLivroApi(livro)).toMatchObject({ quantidadeDisponivel: disponivel, status });
    },
  );
  test.each([
    [5, 0, 5, 'Disponível'],
    [4, 4, 0, 'Em Manutenção'],
    [3, 1, 2, 'Disponível'],
  ])('total %i e manutenção %i dão %i disponíveis', (total, manutencao, disponivel, status) => {
    const linha = {
      id: 7,
      titulo: 'Livro',
      autor: 'Autora',
      isbn: null,
      categoria: null,
      ano_publicacao: null,
      quantidade_total: total,
      quantidade_manutencao: manutencao,
      estante: null,
      prateleira: null,
    } as LivroRow;
    expect(paraLivroApi(linha)).toEqual({
      id: 7,
      titulo: 'Livro',
      autor: 'Autora',
      isbn: null,
      categoria: null,
      anoPublicacao: null,
      quantidadeTotal: total,
      quantidadeManutencao: manutencao,
      quantidadeDisponivel: disponivel,
      status,
      estante: null,
      prateleira: null,
    });
  });
});
