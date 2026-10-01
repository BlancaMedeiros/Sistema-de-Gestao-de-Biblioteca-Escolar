import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../../config/database.js';
import {
  createFuncionario,
  findFuncionarioByLogin,
  updateFuncionarioNome,
  updateFuncionarioSenha,
} from './funcionarios.repository.js';

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

  test('updateFuncionarioNome altera o nome e mantém os demais campos', async () => {
    const criado = await createFuncionario(pool, {
      nome: 'Nome Antigo',
      login: 'teste-repo-renomeado',
      senhaHash: 'hash-fake-5',
    });

    const atualizado = await updateFuncionarioNome(pool, criado.id, 'Nome Novo');

    expect(atualizado).toMatchObject({ id: criado.id, nome: 'Nome Novo', login: 'teste-repo-renomeado' });
  });

  test('updateFuncionarioSenha altera o hash armazenado', async () => {
    const criado = await createFuncionario(pool, {
      nome: 'Vai Trocar Senha',
      login: 'teste-repo-trocasenha',
      senhaHash: 'hash-antigo',
    });

    await updateFuncionarioSenha(pool, criado.id, 'hash-novo');

    const [linhas] = await pool.query('SELECT senha_hash FROM funcionarios WHERE id = ?', [criado.id]);
    expect((linhas as Array<{ senha_hash: string }>)[0].senha_hash).toBe('hash-novo');
  });
});
