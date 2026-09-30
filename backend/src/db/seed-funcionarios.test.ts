import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../config/database.js';
import { verifyPassword } from '../modules/auth/password.js';
import { seedFuncionarios, type FuncionarioSeed } from './seed-funcionarios.js';

describe('seedFuncionarios', () => {
  const seeds: FuncionarioSeed[] = [
    { nome: 'Seed Um', login: 'teste-seed-um', senha: 'senha-um-123' },
    { nome: 'Seed Dois', login: 'teste-seed-dois', senha: 'senha-dois-123' },
  ];

  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login IN (?, ?)', [seeds[0].login, seeds[1].login]);
  });

  test('cria cada funcionário que ainda não existe e informa status "criado"', async () => {
    const resultados = await seedFuncionarios(pool, seeds);

    expect(resultados).toEqual([
      { login: 'teste-seed-um', status: 'criado', id: expect.any(Number) },
      { login: 'teste-seed-dois', status: 'criado', id: expect.any(Number) },
    ]);
  });

  test('ao repetir a execução, não recria nem falha — informa status "ja_existia" com o mesmo id', async () => {
    const primeiraExecucao = await seedFuncionarios(pool, seeds);
    const segundaExecucao = await seedFuncionarios(pool, seeds);

    expect(segundaExecucao).toEqual([
      { login: 'teste-seed-um', status: 'ja_existia', id: primeiraExecucao[0].id },
      { login: 'teste-seed-dois', status: 'ja_existia', id: primeiraExecucao[1].id },
    ]);
  });

  test('ao repetir com uma senha diferente no seed, a senha original continua valendo', async () => {
    await seedFuncionarios(pool, seeds);

    const seedsComSenhaDiferente: FuncionarioSeed[] = [{ ...seeds[0], senha: 'senha-totalmente-outra' }, seeds[1]];
    await seedFuncionarios(pool, seedsComSenhaDiferente);

    const [linhas] = await pool.query('SELECT senha_hash FROM funcionarios WHERE login = ?', [seeds[0].login]);
    const senhaHashAtual = (linhas as Array<{ senha_hash: string }>)[0].senha_hash;

    await expect(verifyPassword(senhaHashAtual, seeds[0].senha)).resolves.toBe(true);
    await expect(verifyPassword(senhaHashAtual, 'senha-totalmente-outra')).resolves.toBe(false);
  });
});
