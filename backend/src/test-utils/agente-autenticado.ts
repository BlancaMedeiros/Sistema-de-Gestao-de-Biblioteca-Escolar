import { randomUUID } from 'node:crypto';
import request from 'supertest';

import { app } from '../app.js';
import { pool } from '../config/database.js';
import { createFuncionario } from '../modules/auth/funcionarios.repository.js';
import { hashPassword } from '../modules/auth/password.js';

export async function criarAgenteAutenticado() {
  const login = `teste-api-${randomUUID()}`;
  const senha = 'Senha-local-de-teste-123';
  const funcionario = await createFuncionario(pool, {
    nome: 'Funcionário de teste',
    login,
    senhaHash: await hashPassword(senha),
  });
  const limpar = async () => {
    await pool.query('DELETE FROM idempotencia WHERE funcionario_id = ?', [funcionario.id]);
    await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [
      funcionario.id,
    ]);
    await pool.query('DELETE FROM funcionarios WHERE id = ?', [funcionario.id]);
  };
  try {
    const agente = request.agent(app);
    const resposta = await agente.post('/api/v1/auth/login').send({ login, senha });
    if (resposta.status !== 200)
      throw new Error(`Falha no login de teste: HTTP ${resposta.status}.`);
    return { agente, funcionario, limpar };
  } catch (erro) {
    await limpar();
    throw erro;
  }
}
