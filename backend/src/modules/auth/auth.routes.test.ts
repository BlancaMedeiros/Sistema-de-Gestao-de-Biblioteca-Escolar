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
    expect(resposta.headers['set-cookie']?.[0]).toMatch(/biblioteca\.sid=/);
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
