import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarCenarioBiblioteca } from '../../test-utils/cenario-biblioteca.js';
import { hojeEscola } from '../../utils/datas.js';

describe('leitores persistentes', () => {
  let c: Awaited<ReturnType<typeof criarCenarioBiblioteca>>;
  beforeEach(async () => {
    c = await criarCenarioBiblioteca();
  });
  afterEach(async () => {
    await c?.limpar();
  });

  test('todas as operações e o histórico exigem sessão', async () => {
    const respostas = [
      await request(app).get('/api/v1/usuarios'),
      await request(app).post('/api/v1/usuarios').send({}),
      await request(app).get('/api/v1/usuarios/1'),
      await request(app).patch('/api/v1/usuarios/1').send({}),
      await request(app).get('/api/v1/usuarios/1/emprestimos'),
    ];
    for (const resposta of respostas) expect(resposta.status).toBe(401);
  });
  test('cadastro não cria conta; permite contato compartilhado e calcula a data', async () => {
    const usuario = await c.usuario({
      nome: `  ${c.prefixo} Nome  `,
      email: 'contato@example.com',
      telefone: '',
      turma: '  5A  ',
      login: 'nao-deve-criar',
      senha: 'nao-deve-criar',
    });
    const segundo = await c.usuario({ email: 'contato@example.com' });
    expect(usuario).toMatchObject({
      nome: `${c.prefixo} Nome`,
      telefone: null,
      turma: '5A',
      status: 'Ativo',
      dataCadastro: hojeEscola(),
    });
    expect(segundo.email).toBe(usuario.email);
    const consulta = await c.agente.get(`/api/v1/usuarios/${usuario.id}`);
    expect(consulta.body.data).toEqual(usuario);
    const [contas] = await pool.query('SELECT id FROM funcionarios WHERE login = ?', [
      'nao-deve-criar',
    ]);
    expect(contas).toHaveLength(0);
  });
  test.each([
    { nome: '' },
    { matricula: '' },
    { tipo: 'Administrador' },
    { status: 'Bloqueado' },
    { nome: 'x'.repeat(161) },
    { matricula: 'x'.repeat(61) },
    { email: 'invalido' },
    { telefone: 'x'.repeat(31) },
    { turma: 'x'.repeat(101) },
    { tipo: undefined },
  ])('valida cadastro: %j', async (dados) => {
    const resposta = await c.agente
      .post('/api/v1/usuarios')
      .send({ nome: c.prefixo, matricula: c.prefixo, tipo: 'Aluno', ...dados });
    expect(resposta.status).toBe(422);
    expect(resposta.body.error.code).toBe('DADOS_INVALIDOS');
  });
  test('matrícula é única também para inativos; edição não altera outros campos', async () => {
    const a = await c.usuario();
    const b = await c.usuario();
    const url = `/api/v1/usuarios/${a.id}`;
    const alterado = await c.agente.patch(url).send({ telefone: '123', status: 'Inativo' });
    expect(alterado.status).toBe(200);
    expect(alterado.body.data).toEqual({ ...a, telefone: '123', status: 'Inativo' });
    expect(
      (
        await c.agente
          .post('/api/v1/usuarios')
          .send({ nome: 'Outro', matricula: a.matricula, tipo: 'Aluno' })
      ).status,
    ).toBe(409);
    expect(
      (await c.agente.patch(`/api/v1/usuarios/${b.id}`).send({ matricula: a.matricula })).body.error
        .code,
    ).toBe('MATRICULA_DUPLICADA');
    expect(
      (await c.agente.patch(url).send({ status: 'Ativo', telefone: null })).body.data.status,
    ).toBe('Ativo');
    for (const corpo of [{}, { papel: 'ADMIN' }, { nome: null }])
      expect((await c.agente.patch(url).send(corpo)).status).toBe(422);
  });
  test('busca literal sem acentos, filtros e paginação estável', async () => {
    const a = await c.usuario({ nome: `${c.prefixo} Ágata%`, tipo: 'Professor' });
    const b = await c.usuario({ nome: `${c.prefixo} Zelia`, status: 'Inativo' });
    const lista = await c.agente.get('/api/v1/usuarios').query({ busca: c.prefixo, pageSize: 1 });
    expect(lista.body.pagination).toEqual({ page: 1, pageSize: 1, total: 2 });
    expect(lista.body.data[0].id).toBe(a.id);
    const pagina2 = await c.agente
      .get('/api/v1/usuarios')
      .query({ busca: c.prefixo, page: 2, pageSize: 1 });
    expect(pagina2.body.data[0].id).toBe(b.id);
    expect(
      (
        await c.agente
          .get('/api/v1/usuarios')
          .query({ busca: `${c.prefixo} agata%`, tipo: 'Professor', status: 'Ativo' })
      ).body.data.map((u: { id: number }) => u.id),
    ).toEqual([a.id]);
    expect(
      (await c.agente.get('/api/v1/usuarios').query({ busca: a.matricula })).body.data[0].id,
    ).toBe(a.id);
    for (const query of [
      { page: 0 },
      { pageSize: 101 },
      { page: '1.5' },
      { busca: 'x'.repeat(101) },
      { status: 'Outro' },
    ])
      expect((await c.agente.get('/api/v1/usuarios').query(query)).status).toBe(422);
  });
  test('IDs inválidos e inexistentes retornam 404', async () => {
    for (const id of ['0', 'abc', '4294967295']) {
      expect((await c.agente.get(`/api/v1/usuarios/${id}`)).status).toBe(404);
      expect((await c.agente.patch(`/api/v1/usuarios/${id}`).send({ nome: 'Outro' })).status).toBe(
        404,
      );
      expect((await c.agente.get(`/api/v1/usuarios/${id}/emprestimos`)).status).toBe(404);
    }
  });
  test('histórico vazio existe e leitor com empréstimo aberto não pode ser inativado', async () => {
    const usuario = await c.usuario();
    const livro = await c.livro();
    const vazio = await c.agente.get(`/api/v1/usuarios/${usuario.id}/emprestimos`);
    expect(vazio.body.data).toEqual([]);
    expect(vazio.body.resumo).toEqual({ totalEmprestimos: 0, emprestimosAtivos: 0, atrasados: 0 });
    const emprestimo = await c.emprestar(livro.id, usuario.id);
    expect(emprestimo.status).toBe(201);
    const bloqueado = await c.agente
      .patch(`/api/v1/usuarios/${usuario.id}`)
      .send({ status: 'Inativo', nome: 'Não deve mudar' });
    expect(bloqueado.status).toBe(409);
    expect(bloqueado.body.error.code).toBe('USUARIO_COM_EMPRESTIMOS');
    expect((await c.agente.get(`/api/v1/usuarios/${usuario.id}`)).body.data).toEqual(usuario);
    await c.acao(emprestimo.body.data.id, 'devolucao');
    expect(
      (await c.agente.patch(`/api/v1/usuarios/${usuario.id}`).send({ status: 'Inativo' })).status,
    ).toBe(200);
    const historico = await c.agente.get(`/api/v1/usuarios/${usuario.id}/emprestimos`);
    expect(historico.body.data[0].status).toBe('Devolvido');
    expect(historico.body.resumo).toEqual({
      totalEmprestimos: 1,
      emprestimosAtivos: 0,
      atrasados: 0,
    });
  });
});
