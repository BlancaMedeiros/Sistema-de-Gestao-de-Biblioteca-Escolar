import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { pool } from '../../config/database.js';
import { createFuncionario } from './funcionarios.repository.js';
import { hashPassword } from './password.js';

// Reproduz a produção: NODE_ENV=production (cookie Secure) e o HTTPS
// terminado no proxy do Google (Cloud Run / Firebase Hosting), que repassa a
// requisição ao Express por HTTP com X-Forwarded-Proto: https.
describe('sessão em produção, atrás do proxy do Cloud Run', () => {
  const login = 'teste-sessao-prod';
  const senha = 'senha-correta-prod';
  let funcionarioId: number;

  beforeEach(async () => {
    const criado = await createFuncionario(pool, { nome: 'Sessão Prod', login, senhaHash: await hashPassword(senha) });
    funcionarioId = criado.id;
  });

  afterEach(async () => {
    await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [funcionarioId]);
    await pool.query('DELETE FROM funcionarios WHERE login = ?', [login]);
  });

  async function carregarAppDeProducao() {
    vi.stubEnv('NODE_ENV', 'production');
    vi.resetModules();
    const { app } = await import('../../app.js');
    const { pool: poolDoApp } = await import('../../config/database.js');

    return { app, poolDoApp };
  }

  test('o login devolve o cookie de sessão Secure com o nome que o Firebase Hosting repassa (__session)', async () => {
    const { app, poolDoApp } = await carregarAppDeProducao();

    try {
      const resposta = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ login, senha });

      expect(resposta.status).toBe(200);
      const cookie = resposta.headers['set-cookie']?.[0] ?? '';
      expect(cookie).toMatch(/^__session=/);
      expect(cookie).toMatch(/;\s*Secure/i);
    } finally {
      await poolDoApp.end();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });

  test('o cookie devolvido mantém a sessão no /me seguinte', async () => {
    const { app, poolDoApp } = await carregarAppDeProducao();

    try {
      const loginResposta = await request(app)
        .post('/api/v1/auth/login')
        .set('X-Forwarded-Proto', 'https')
        .send({ login, senha });
      const cookie = (loginResposta.headers['set-cookie']?.[0] ?? '').split(';')[0];

      const me = await request(app).get('/api/v1/me').set('X-Forwarded-Proto', 'https').set('Cookie', cookie);

      expect(me.status).toBe(200);
      expect(me.body.data).toMatchObject({ login });
    } finally {
      await poolDoApp.end();
      vi.unstubAllEnvs();
      vi.resetModules();
    }
  });
});
