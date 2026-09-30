import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../../config/database.js';
import { createFuncionario, findFuncionarioByLogin } from './funcionarios.repository.js';

describe('funcionarios.repository', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login LIKE ?', ['teste-repo-%']);
  });

  test('createFuncionario insere e retorna o funcionário com ativo=true', async () => {
    const criado = await createFuncionario(pool, {
      nome: 'Fulana de Teste',
      login: 'teste-repo-fulana',
      senhaHash: 'hash-fake',
    });

    expect(criado).toMatchObject({
      nome: 'Fulana de Teste',
      login: 'teste-repo-fulana',
      senha_hash: 'hash-fake',
      ativo: 1,
    });
    expect(criado.id).toBeGreaterThan(0);
  });

  test('findFuncionarioByLogin encontra um funcionário existente', async () => {
    await createFuncionario(pool, {
      nome: 'Ciclano de Teste',
      login: 'teste-repo-ciclano',
      senhaHash: 'hash-fake-2',
    });

    const encontrado = await findFuncionarioByLogin(pool, 'teste-repo-ciclano');

    expect(encontrado).toMatchObject({ login: 'teste-repo-ciclano' });
  });

  test('findFuncionarioByLogin retorna null quando não existe', async () => {
    const encontrado = await findFuncionarioByLogin(pool, 'teste-repo-inexistente');

    expect(encontrado).toBeNull();
  });

  test('createFuncionario rejeita login duplicado', async () => {
    await createFuncionario(pool, {
      nome: 'Original',
      login: 'teste-repo-duplicado',
      senhaHash: 'hash-fake-3',
    });

    await expect(
      createFuncionario(pool, {
        nome: 'Repetido',
        login: 'teste-repo-duplicado',
        senhaHash: 'hash-fake-4',
      }),
    ).rejects.toMatchObject({ code: 'ER_DUP_ENTRY' });
  });
});
