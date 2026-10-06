import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { createFuncionario } from './funcionarios.repository.js';
import { hashPassword } from './password.js';

describe('POST /api/v1/auth/login', () => {
  const login = 'teste-rotas-login';
  const senha = 'senha-correta-123';
  let funcionarioId: number;

  beforeEach(async () => {
    const criado = await createFuncionario(pool, { nome: 'Rotas Teste', login, senhaHash: await hashPassword(senha) });
    funcionarioId = criado.id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [funcionarioId]);
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
  });

  test('retorna 200 e um cookie de sessão para credenciais válidas', async () => {
    const resposta = await request(app).post('/api/v1/auth/login').send({ login, senha });

    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toMatchObject({ login });
    expect(resposta.body.data.senha_hash).toBeUndefined();
    expect(resposta.headers['set-cookie']?.[0]).toMatch(/^__session=/);
  });

  test('retorna 401 para senha incorreta', async () => {
    const resposta = await request(app).post('/api/v1/auth/login').send({ login, senha: 'errada' });

    expect(resposta.status).toBe(401);
  });

  test('retorna 422 quando falta a senha', async () => {
    const resposta = await request(app).post('/api/v1/auth/login').send({ login });

    expect(resposta.status).toBe(422);
  });
});

describe('fluxo login -> /api/v1/me -> logout', () => {
  const login = 'teste-rotas-fluxo';
  const senha = 'senha-correta-456';

  beforeEach(async () => {
    await createFuncionario(pool, { nome: 'Fluxo Teste', login, senhaHash: await hashPassword(senha) });
  });

  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
  });

  test('mantém a sessão entre requisições e permite logout', async () => {
    const agent = request.agent(app);

    const loginResponse = await agent.post('/api/v1/auth/login').send({ login, senha });
    expect(loginResponse.status).toBe(200);

    const meResponse = await agent.get('/api/v1/me');
    expect(meResponse.status).toBe(200);
    expect(meResponse.body.data).toMatchObject({ login });

    const logoutResponse = await agent.post('/api/v1/auth/logout');
    expect(logoutResponse.status).toBe(204);

    const meAfterLogout = await agent.get('/api/v1/me');
    expect(meAfterLogout.status).toBe(401);
  });
});

describe('GET /api/v1/me sem sessão', () => {
  test('retorna 401', async () => {
    const resposta = await request(app).get('/api/v1/me');

    expect(resposta.status).toBe(401);
  });
});

describe('PATCH /api/v1/me', () => {
  const login = 'teste-rotas-patch-me';
  const senha = 'senha-correta-789';
  let funcionarioId: number;

  beforeEach(async () => {
    const criado = await createFuncionario(pool, { nome: 'Nome Original', login, senhaHash: await hashPassword(senha) });
    funcionarioId = criado.id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [funcionarioId]);
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
  });

  test('atualiza o nome e reflete no /me seguinte', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ login, senha });

    const patchResponse = await agent.patch('/api/v1/me').send({ nome: 'Nome Atualizado' });
    expect(patchResponse.status).toBe(200);
    expect(patchResponse.body.data).toMatchObject({ nome: 'Nome Atualizado', login });

    const meResponse = await agent.get('/api/v1/me');
    expect(meResponse.body.data).toMatchObject({ nome: 'Nome Atualizado' });
  });

  test('retorna 422 para nome vazio', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ login, senha });

    const resposta = await agent.patch('/api/v1/me').send({ nome: '' });

    expect(resposta.status).toBe(422);
  });

  test('retorna 401 sem sessão', async () => {
    const resposta = await request(app).patch('/api/v1/me').send({ nome: 'Qualquer' });

    expect(resposta.status).toBe(401);
  });
});

describe('PUT /api/v1/me/senha', () => {
  const login = 'teste-rotas-put-senha';
  const senha = 'senha-antiga-123';
  let funcionarioId: number;

  beforeEach(async () => {
    const criado = await createFuncionario(pool, { nome: 'Troca Senha', login, senhaHash: await hashPassword(senha) });
    funcionarioId = criado.id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [funcionarioId]);
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
  });

  test('troca a senha e permite login só com a nova', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ login, senha });

    const putResponse = await agent
      .put('/api/v1/me/senha')
      .send({ senhaAtual: senha, novaSenha: 'senha-nova-456' });
    expect(putResponse.status).toBe(204);

    const loginComSenhaAntiga = await request(app).post('/api/v1/auth/login').send({ login, senha });
    expect(loginComSenhaAntiga.status).toBe(401);

    const loginComSenhaNova = await request(app)
      .post('/api/v1/auth/login')
      .send({ login, senha: 'senha-nova-456' });
    expect(loginComSenhaNova.status).toBe(200);
  });

  test('retorna 401 quando a senha atual está incorreta, sem alterar a senha', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ login, senha });

    const resposta = await agent.put('/api/v1/me/senha').send({ senhaAtual: 'errada', novaSenha: 'senha-nova-456' });

    expect(resposta.status).toBe(401);
    expect(resposta.body.error.code).toBe('SENHA_ATUAL_INVALIDA');
  });

  test('retorna 422 para nova senha muito curta', async () => {
    const agent = request.agent(app);
    await agent.post('/api/v1/auth/login').send({ login, senha });

    const resposta = await agent.put('/api/v1/me/senha').send({ senhaAtual: senha, novaSenha: '123' });

    expect(resposta.status).toBe(422);
  });

  test('retorna 401 sem sessão', async () => {
    const resposta = await request(app)
      .put('/api/v1/me/senha')
      .send({ senhaAtual: senha, novaSenha: 'senha-nova-456' });

    expect(resposta.status).toBe(401);
  });

  test('invalida as outras sessões do funcionário, mantendo a sessão atual', async () => {
    const agentAtual = request.agent(app);
    const agentOutro = request.agent(app);
    await agentAtual.post('/api/v1/auth/login').send({ login, senha });
    await agentOutro.post('/api/v1/auth/login').send({ login, senha });

    const putResponse = await agentAtual
      .put('/api/v1/me/senha')
      .send({ senhaAtual: senha, novaSenha: 'senha-nova-456' });
    expect(putResponse.status).toBe(204);

    const meComSessaoAtual = await agentAtual.get('/api/v1/me');
    expect(meComSessaoAtual.status).toBe(200);

    const meComSessaoOutra = await agentOutro.get('/api/v1/me');
    expect(meComSessaoOutra.status).toBe(401);
  });
});
