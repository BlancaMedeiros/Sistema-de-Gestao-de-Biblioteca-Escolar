import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../../config/database.js';
import { alterarSenha, autenticar } from './auth.service.js';
import { createFuncionario, findFuncionarioById } from './funcionarios.repository.js';
import { hashPassword, verifyPassword } from './password.js';

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

describe('alterarSenha', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login LIKE ?', ['teste-service-%']);
  });

  test('troca a senha quando a senha atual está correta', async () => {
    const criado = await createFuncionario(pool, {
      nome: 'Dani Teste',
      login: 'teste-service-dani',
      senhaHash: await hashPassword('senha-antiga'),
    });

    const resultado = await alterarSenha(pool, criado.id, 'senha-antiga', 'senha-nova-123');

    expect(resultado).toBe('ok');
    const atualizado = await findFuncionarioById(pool, criado.id);
    await expect(verifyPassword(atualizado!.senha_hash, 'senha-nova-123')).resolves.toBe(true);
    await expect(verifyPassword(atualizado!.senha_hash, 'senha-antiga')).resolves.toBe(false);
  });

  test('não troca a senha quando a senha atual está incorreta', async () => {
    const criado = await createFuncionario(pool, {
      nome: 'Edu Teste',
      login: 'teste-service-edu',
      senhaHash: await hashPassword('senha-antiga'),
    });

    const resultado = await alterarSenha(pool, criado.id, 'senha-errada', 'senha-nova-123');

    expect(resultado).toBe('senha_atual_invalida');
    const atualizado = await findFuncionarioById(pool, criado.id);
    await expect(verifyPassword(atualizado!.senha_hash, 'senha-antiga')).resolves.toBe(true);
  });
});
