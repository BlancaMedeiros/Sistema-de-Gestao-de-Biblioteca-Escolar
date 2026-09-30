import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../../config/database.js';
import { autenticar } from './auth.service.js';
import { createFuncionario } from './funcionarios.repository.js';
import { hashPassword } from './password.js';

describe('autenticar', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login LIKE ?', ['teste-service-%']);
  });

  test('retorna os dados do funcionário para login e senha corretos', async () => {
    const senhaHash = await hashPassword('senha-correta');
    await createFuncionario(pool, { nome: 'Ana Teste', login: 'teste-service-ana', senhaHash });

    const resultado = await autenticar(pool, 'teste-service-ana', 'senha-correta');

    expect(resultado).toMatchObject({ nome: 'Ana Teste', login: 'teste-service-ana' });
  });

  test('retorna null para senha incorreta', async () => {
    const senhaHash = await hashPassword('senha-correta');
    await createFuncionario(pool, { nome: 'Bruno Teste', login: 'teste-service-bruno', senhaHash });

    const resultado = await autenticar(pool, 'teste-service-bruno', 'senha-errada');

    expect(resultado).toBeNull();
  });

  test('retorna null para login inexistente', async () => {
    const resultado = await autenticar(pool, 'teste-service-inexistente', 'qualquer');

    expect(resultado).toBeNull();
  });

  test('retorna null para funcionário inativo mesmo com senha correta', async () => {
    const senhaHash = await hashPassword('senha-correta');
    const criado = await createFuncionario(pool, {
      nome: 'Carla Teste',
      login: 'teste-service-carla',
      senhaHash,
    });
    await pool.query('UPDATE funcionarios SET ativo = 0 WHERE id = ?', [criado.id]);

    const resultado = await autenticar(pool, 'teste-service-carla', 'senha-correta');

    expect(resultado).toBeNull();
  });
});
