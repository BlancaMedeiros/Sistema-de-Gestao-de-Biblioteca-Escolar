import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarAgenteAutenticado } from '../../test-utils/agente-autenticado.js';

describe('cadastro HTTP de funcionários', () => {
  let sessao: Awaited<ReturnType<typeof criarAgenteAutenticado>>;
  let login: string;
  beforeEach(async () => {
    sessao = await criarAgenteAutenticado();
    login = `qat-f-${randomUUID()}`;
  });
  afterEach(async () => {
    const [linhas] = await pool.query('SELECT id FROM funcionarios WHERE login = ?', [login]);
    for (const linha of linhas as Array<{ id: number }>) {
      await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [
        linha.id,
      ]);
    }
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
    await sessao?.limpar();
  });
  test('funcionário inativado perde a sessão existente em todas as APIs', async () => {
    await pool.query('UPDATE funcionarios SET ativo = 0 WHERE id = ?', [sessao.funcionario.id]);
    for (const caminho of [
      '/api/v1/usuarios',
      '/api/v1/livros',
      '/api/v1/emprestimos',
      '/api/v1/dashboard',
      '/api/v1/relatorios/pendencias',
    ]) {
      const resposta = await sessao.agente.get(caminho);
      expect(resposta.status).toBe(401);
      expect(resposta.body.error.code).toBe('NAO_AUTENTICADO');
    }
    const resposta = await sessao.agente
      .post('/api/v1/funcionarios')
      .send({ nome: 'QAT', login, senha: 'Senha-qat-123' });
    expect(resposta.status).toBe(401);
    const [sessoes] = await pool.query(
      "SELECT id FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?",
      [sessao.funcionario.id],
    );
    expect(sessoes).toHaveLength(0);
  });
  test('exige sessão, cadastra com mesmo nível, omite senha/hash e permite login', async () => {
    const dados = { nome: '  Funcionário QAT  ', login, senha: 'Senha-qat-123', papel: 'ADMIN' };
    expect((await request(app).post('/api/v1/funcionarios').send(dados)).status).toBe(401);
    const criado = await sessao.agente.post('/api/v1/funcionarios').send(dados);
    expect(criado.status).toBe(201);
    expect(criado.body.data).toMatchObject({
      cargo: 'Funcionário autorizado',
      email: null,
      telefone: null,
      usuarioId: null,
      matricula: null,
      emprestimosAtivos: 0,
      historicoTotal: 0,
    });
    expect(criado.body.data.senha_hash).toBeUndefined();
    expect(criado.body.data.senha).toBeUndefined();
    expect(criado.body.data.nome).toBe('Funcionário QAT');
    expect(
      (await request(app).post('/api/v1/auth/login').send({ login, senha: dados.senha })).status,
    ).toBe(200);
    const duplicado = await sessao.agente.post('/api/v1/funcionarios').send(dados);
    expect(duplicado.status).toBe(409);
    expect(duplicado.body.error.code).toBe('LOGIN_DUPLICADO');
  });
  test.each([
    { nome: '' },
    { login: 'com espaco' },
    { senha: 'curta' },
    { nome: 'x'.repeat(121) },
    { login: 'x'.repeat(61) },
  ])('valida %j', async (dados) => {
    expect(
      (
        await sessao.agente
          .post('/api/v1/funcionarios')
          .send({ nome: 'QAT', login, senha: 'Senha-qat-123', ...dados })
      ).status,
    ).toBe(422);
  });
});
