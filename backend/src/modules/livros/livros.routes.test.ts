import { randomInt, randomUUID } from 'node:crypto';
import type { RowDataPacket } from 'mysql2/promise';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarAgenteAutenticado } from '../../test-utils/agente-autenticado.js';

describe('API de livros com MySQL real', () => {
  let sessao: Awaited<ReturnType<typeof criarAgenteAutenticado>>;
  let prefixo: string;
  let ids: number[];
  const novoIsbn = () => String(randomInt(1_000_000_000_000, 9_999_999_999_999));

  beforeEach(async () => {
    prefixo = `qat-${randomUUID()}`;
    ids = [];
    sessao = await criarAgenteAutenticado();
  });
  afterEach(async () => {
    try {
      if (ids.length) await pool.query('DELETE FROM livros WHERE id IN (?)', [ids]);
    } finally {
      await sessao?.limpar();
    }
  });

  async function criar(alteracoes: Record<string, unknown> = {}) {
    const resposta = await sessao.agente.post('/api/v1/livros').send({
      titulo: `${prefixo} Livro`,
      autor: `${prefixo} Autora`,
      quantidadeTotal: 5,
      ...alteracoes,
    });
    if (resposta.status === 201) ids.push(resposta.body.data.id);
    return resposta;
  }

  test.each(['listar', 'consultar', 'cadastrar', 'editar', 'excluir'])(
    '%s exige sessão',
    async (operacao) => {
      const cliente = request(app);
      const resposta =
        operacao === 'listar'
          ? await cliente.get('/api/v1/livros')
          : operacao === 'consultar'
            ? await cliente.get('/api/v1/livros/1')
            : operacao === 'cadastrar'
              ? await cliente.post('/api/v1/livros').send({})
              : operacao === 'editar'
                ? await cliente.patch('/api/v1/livros/1').send({})
                : await cliente.delete('/api/v1/livros/1');
      expect(resposta.status).toBe(401);
      expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
    },
  );

  test('cadastra, normaliza texto, calcula disponibilidade e relê pela API e por outra conexão', async () => {
    const criado = await criar({
      titulo: `  ${prefixo} Livro  `,
      quantidadeManutencao: 1,
      categoria: '   ',
      status: 'Esgotado',
      quantidadeDisponivel: 999,
    });
    expect(criado.status).toBe(201);
    expect(criado.body.data).toMatchObject({
      titulo: `${prefixo} Livro`,
      quantidadeTotal: 5,
      quantidadeManutencao: 1,
      quantidadeDisponivel: 4,
      status: 'Disponível',
      isbn: null,
      categoria: null,
      anoPublicacao: null,
    });
    const consulta = await sessao.agente.get(`/api/v1/livros/${criado.body.data.id}`);
    expect(consulta.status).toBe(200);
    expect(consulta.body.data).toEqual(criado.body.data);
    const conexao = await pool.getConnection();
    try {
      const [linhas] = await conexao.query<RowDataPacket[]>(
        'SELECT titulo FROM livros WHERE id = ?',
        [criado.body.data.id],
      );
      expect(linhas[0].titulo).toBe(`${prefixo} Livro`);
    } finally {
      conexao.release();
    }
  });

  test.each([
    ['titulo', { titulo: undefined }],
    ['titulo', { titulo: '   ' }],
    ['autor', { autor: null }],
    ['titulo', { titulo: 'x'.repeat(256) }],
    ['categoria', { categoria: 'x'.repeat(101) }],
    ['estante', { estante: 'x'.repeat(61) }],
    ['prateleira', { prateleira: 'x'.repeat(61) }],
    ['quantidadeTotal', { quantidadeTotal: 0 }],
    ['quantidadeTotal', { quantidadeTotal: 1.5 }],
    ['quantidadeTotal', { quantidadeTotal: '5' }],
    ['quantidadeTotal', { quantidadeTotal: 4_294_967_296 }],
    ['quantidadeManutencao', { quantidadeManutencao: -1 }],
    ['quantidadeManutencao', { quantidadeManutencao: 6 }],
    ['isbn', { isbn: 'abc' }],
    ['anoPublicacao', { anoPublicacao: 999 }],
    ['anoPublicacao', { anoPublicacao: new Date().getFullYear() + 2 }],
    ['anoPublicacao', { anoPublicacao: 2000.5 }],
  ])('recusa cadastro inválido em %s: %j', async (campo, dados) => {
    const resposta = await criar(dados);
    expect(resposta.status).toBe(422);
    expect(resposta.body.error.code).toBe('DADOS_INVALIDOS');
    expect(resposta.body.error.fields[campo]).toBeDefined();
    const [linhas] = await pool.query<RowDataPacket[]>(
      'SELECT id FROM livros WHERE titulo LIKE ?',
      [`${prefixo}%`],
    );
    expect(linhas).toHaveLength(0);
  });

  test('reserva ISBN normalizado, inclusive após inativação, e rejeita conflito no PATCH', async () => {
    const isbn = novoIsbn();
    const primeiro = await criar({ isbn: `${isbn.slice(0, 3)}-${isbn.slice(3)}` });
    expect(primeiro.status).toBe(201);
    expect(primeiro.body.data.isbn).toBe(isbn);
    const segundo = await criar();
    expect((await criar({ isbn })).status).toBe(409);
    const conflito = await sessao.agente
      .patch(`/api/v1/livros/${segundo.body.data.id}`)
      .send({ isbn });
    expect(conflito.status).toBe(409);
    expect(conflito.body.error.code).toBe('ISBN_DUPLICADO');
    await sessao.agente.delete(`/api/v1/livros/${primeiro.body.data.id}`);
    expect((await criar({ isbn })).status).toBe(409);
    const [linhas] = await pool.query<RowDataPacket[]>('SELECT id FROM livros WHERE isbn = ?', [
      isbn,
    ]);
    expect(linhas).toHaveLength(1);
  });

  test('aceita múltiplos livros sem ISBN e normaliza ISBN-10 com X', async () => {
    for (const isbn of [null, '', undefined]) {
      const resposta = await criar({ isbn });
      expect(resposta.status).toBe(201);
      expect(resposta.body.data.isbn).toBeNull();
    }
    const isbn = `${String(randomInt(100_000_000, 999_999_999))}x`;
    expect((await criar({ isbn })).body.data.isbn).toBe(isbn.toUpperCase());
  });

  test('busca em todos os campos previstos, ignora caixa/acentos e exclui inativos', async () => {
    const isbn = novoIsbn();
    const criado = await criar({
      titulo: `${prefixo} Memórias`,
      autor: `${prefixo} Álvares`,
      isbn,
      estante: `${prefixo}-E1`,
      prateleira: `${prefixo}-P1`,
    });
    const outro = await criar({ titulo: `${prefixo} Não corresponde` });
    for (const busca of [
      `${prefixo} MEMORIAS`,
      `${prefixo} alvares`,
      isbn,
      `${prefixo}-E1`,
      `${prefixo}-P1`,
    ]) {
      const resposta = await sessao.agente.get('/api/v1/livros').query({ busca: `  ${busca}  ` });
      expect(resposta.status).toBe(200);
      expect(resposta.body.data.map((livro: { id: number }) => livro.id)).toContain(
        criado.body.data.id,
      );
      expect(resposta.body.data.map((livro: { id: number }) => livro.id)).not.toContain(
        outro.body.data.id,
      );
    }
    await sessao.agente.delete(`/api/v1/livros/${criado.body.data.id}`);
    const lista = await sessao.agente.get('/api/v1/livros').query({ busca: isbn });
    expect(lista.body.data).toEqual([]);
  });

  test('ordena por título e aceita busca vazia sem paginação', async () => {
    const z = await criar({ titulo: `${prefixo} Z` });
    const a = await criar({ titulo: `${prefixo} A` });
    const lista = await sessao.agente.get('/api/v1/livros').query({ busca: prefixo });
    expect(lista.body.data.map((livro: { id: number }) => livro.id)).toEqual([
      a.body.data.id,
      z.body.data.id,
    ]);
    const vazia = await sessao.agente.get('/api/v1/livros').query({ busca: '   ' });
    expect(vazia.status).toBe(200);
    expect(vazia.body.data.map((livro: { id: number }) => livro.id)).toEqual(
      expect.arrayContaining(ids),
    );
  });

  test.each(['%', '_', '!', "' OR 1=1 --", '\\'])(
    'busca trata %s como texto literal',
    async (simbolo) => {
      const alvo = await criar({ titulo: `${prefixo}${simbolo}alvo` });
      await criar({ titulo: `${prefixo}Xalvo` });
      const resposta = await sessao.agente
        .get('/api/v1/livros')
        .query({ busca: `${prefixo}${simbolo}` });
      expect(resposta.status).toBe(200);
      expect(resposta.body.data.map((livro: { id: number }) => livro.id)).toEqual([
        alvo.body.data.id,
      ]);
    },
  );

  test('valida busca com mais de 100 caracteres ou parâmetros repetidos', async () => {
    for (const query of [{ busca: 'a'.repeat(101) }, { busca: ['a', 'b'] }]) {
      const resposta = await sessao.agente.get('/api/v1/livros').query(query);
      expect(resposta.status).toBe(422);
      expect(resposta.body.error.fields.busca).toBeDefined();
    }
  });

  test('PATCH preserva campos omitidos, limpa opcionais e ignora valores calculados', async () => {
    const criado = await criar({
      isbn: novoIsbn(),
      categoria: 'Categoria',
      anoPublicacao: 2000,
      estante: 'E1',
      prateleira: 'P1',
    });
    const url = `/api/v1/livros/${criado.body.data.id}`;
    const alterado = await sessao.agente
      .patch(url)
      .send({ autor: '  Outra autora  ', quantidadeDisponivel: 999, status: 'Esgotado' });
    expect(alterado.status).toBe(200);
    expect(alterado.body.data).toEqual({ ...criado.body.data, autor: 'Outra autora' });
    const limpo = await sessao.agente
      .patch(url)
      .send({ isbn: null, categoria: '', anoPublicacao: null, estante: null, prateleira: '  ' });
    expect(limpo.status).toBe(200);
    expect(limpo.body.data).toMatchObject({
      isbn: null,
      categoria: null,
      anoPublicacao: null,
      estante: null,
      prateleira: null,
    });
    for (const corpo of [
      {},
      { desconhecido: 'x' },
      { quantidadeDisponivel: 999 },
      { titulo: null },
    ]) {
      expect((await sessao.agente.patch(url).send(corpo)).status).toBe(422);
    }
  });

  test('valida PATCH contra as quantidades persistidas, permite mudança conjunta e recalcula status', async () => {
    const criado = await criar({ quantidadeTotal: 5, quantidadeManutencao: 4 });
    const url = `/api/v1/livros/${criado.body.data.id}`;
    const invalido = await sessao.agente.patch(url).send({ quantidadeTotal: 3 });
    expect(invalido.status).toBe(422);
    expect(invalido.body.error.fields.quantidadeTotal).toBeDefined();
    expect((await sessao.agente.get(url)).body.data).toEqual(criado.body.data);
    const conjunto = await sessao.agente
      .patch(url)
      .send({ quantidadeTotal: 3, quantidadeManutencao: 1 });
    expect(conjunto.status).toBe(200);
    expect(conjunto.body.data.quantidadeDisponivel).toBe(2);
    const manutencao = await sessao.agente.patch(url).send({ quantidadeManutencao: 3 });
    expect(manutencao.body.data).toMatchObject({
      quantidadeDisponivel: 0,
      status: 'Em Manutenção',
    });
  });

  test.each(['0', '-1', '1.5', 'abc', '4294967296', '999999999999999999999', '4294967295'])(
    'GET/PATCH/DELETE de ID inválido ou inexistente %s dão 404',
    async (id) => {
      for (const resposta of [
        await sessao.agente.get(`/api/v1/livros/${id}`),
        await sessao.agente.patch(`/api/v1/livros/${id}`).send({ titulo: 'Outro' }),
        await sessao.agente.delete(`/api/v1/livros/${id}`),
      ]) {
        expect(resposta.status).toBe(404);
        expect(resposta.body.error.code).toBe('LIVRO_NAO_ENCONTRADO');
      }
    },
  );

  test('DELETE inativa sem apagar, e GET/PATCH/DELETE seguintes não acessam o livro', async () => {
    const criado = await criar();
    const url = `/api/v1/livros/${criado.body.data.id}`;
    const removido = await sessao.agente.delete(url);
    expect(removido.status).toBe(204);
    expect(removido.text).toBe('');
    expect((await sessao.agente.get(url)).status).toBe(404);
    expect((await sessao.agente.patch(url).send({ titulo: 'Outro' })).status).toBe(404);
    expect((await sessao.agente.delete(url)).status).toBe(404);
    const lista = await sessao.agente.get('/api/v1/livros').query({ busca: prefixo });
    expect(lista.body.data).toEqual([]);
    const [linhas] = await pool.query<RowDataPacket[]>('SELECT ativo FROM livros WHERE id = ?', [
      criado.body.data.id,
    ]);
    expect(linhas).toHaveLength(1);
    expect(linhas[0].ativo).toBe(0);
  });

  test('cadastros concorrentes com mesmo ISBN produzem um sucesso e um conflito', async () => {
    const isbn = novoIsbn();
    const respostas = await Promise.all([criar({ isbn }), criar({ isbn })]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    const [linhas] = await pool.query<RowDataPacket[]>('SELECT id FROM livros WHERE isbn = ?', [
      isbn,
    ]);
    expect(linhas).toHaveLength(1);
  });

  test('PATCHes concorrentes preservam campos distintos e a invariante de quantidade', async () => {
    const criado = await criar();
    const url = `/api/v1/livros/${criado.body.data.id}`;
    const textos = await Promise.all([
      sessao.agente.patch(url).send({ autor: 'Autora concorrente' }),
      sessao.agente.patch(url).send({ categoria: 'Categoria concorrente' }),
    ]);
    expect(textos.map((r) => r.status)).toEqual([200, 200]);
    expect((await sessao.agente.get(url)).body.data).toMatchObject({
      autor: 'Autora concorrente',
      categoria: 'Categoria concorrente',
    });
    const quantidades = await Promise.all([
      sessao.agente.patch(url).send({ quantidadeTotal: 1 }),
      sessao.agente.patch(url).send({ quantidadeManutencao: 4 }),
    ]);
    expect(quantidades.map((r) => r.status).sort()).toEqual([200, 422]);
    const final = (await sessao.agente.get(url)).body.data;
    expect(final.quantidadeTotal).toBeGreaterThanOrEqual(final.quantidadeManutencao);
    expect(final.quantidadeDisponivel).toBe(final.quantidadeTotal - final.quantidadeManutencao);
  });

  test('MySQL também impede quantidades inválidas por CHECK', async () => {
    const criado = await criar();
    await expect(
      pool.query('UPDATE livros SET quantidade_manutencao = 6 WHERE id = ?', [criado.body.data.id]),
    ).rejects.toMatchObject({ code: 'ER_CHECK_CONSTRAINT_VIOLATED' });
  });

  test('Swagger documenta as cinco operações, sessão e schemas sem referências quebradas', async () => {
    const resposta = await request(app).get('/api/docs.json');
    expect(resposta.status).toBe(200);
    const contrato = resposta.body;
    for (const [caminho, metodos] of [
      ['/livros', ['get', 'post']],
      ['/livros/{id}', ['get', 'patch', 'delete']],
    ] as const) {
      for (const metodo of metodos)
        expect(contrato.paths[caminho][metodo].security).toEqual([{ sessao: [] }]);
    }
    const referencias = JSON.stringify(contrato).matchAll(/"\$ref":"#\/([^" ]+)"/g);
    for (const referencia of referencias) {
      const destino = referencia[1].split('/').reduce((objeto, chave) => objeto?.[chave], contrato);
      expect(destino, referencia[1]).toBeDefined();
    }
    expect(contrato.components.securitySchemes.sessao.name).toBe('__session');
  });
});
