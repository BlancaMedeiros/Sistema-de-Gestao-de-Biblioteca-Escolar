import { afterEach, describe, expect, test } from 'vitest';

import { pool } from '../../config/database.js';
import { findFuncionarioByLogin } from './funcionarios.repository.js';
import { verifyPassword } from './password.js';
import { provisionarFuncionario } from './provisionar-funcionario.js';

describe('provisionarFuncionario', () => {
  afterEach(async () => {
    await pool.query('DELETE FROM funcionarios WHERE login LIKE ?', ['teste-prov-%']);
  });

  test('cria o funcionário com a senha guardada como hash e campos sem espaços nas pontas', async () => {
    const resultado = await provisionarFuncionario(pool, {
      nome: '  Maria Provisionada  ',
      login: '  teste-prov-maria  ',
      senha: 'senha-forte-123',
    });

    expect(resultado).toEqual({ status: 'criado', id: expect.any(Number), login: 'teste-prov-maria' });
    const salvo = await findFuncionarioByLogin(pool, 'teste-prov-maria');
    expect(salvo?.nome).toBe('Maria Provisionada');
    expect(salvo?.senha_hash).not.toBe('senha-forte-123');
    await expect(verifyPassword(salvo!.senha_hash, 'senha-forte-123')).resolves.toBe(true);
  });

  test('recusa senha com menos de 8 caracteres e não grava nada', async () => {
    const resultado = await provisionarFuncionario(pool, { nome: 'Curta', login: 'teste-prov-curta', senha: '1234567' });

    expect(resultado).toMatchObject({ status: 'dados_invalidos' });
    expect(await findFuncionarioByLogin(pool, 'teste-prov-curta')).toBeNull();
  });

  test('recusa nome vazio, login vazio e login com espaço no meio', async () => {
    const semNome = await provisionarFuncionario(pool, { nome: '   ', login: 'teste-prov-x', senha: 'senha-forte-123' });
    const semLogin = await provisionarFuncionario(pool, { nome: 'Alguém', login: '  ', senha: 'senha-forte-123' });
    const loginComEspaco = await provisionarFuncionario(pool, {
      nome: 'Alguém',
      login: 'teste-prov com espaco',
      senha: 'senha-forte-123',
    });

    expect(semNome).toMatchObject({ status: 'dados_invalidos' });
    expect(semLogin).toMatchObject({ status: 'dados_invalidos' });
    expect(loginComEspaco).toMatchObject({ status: 'dados_invalidos' });
  });

  test('recusa login maior que 60 caracteres (limite da coluna)', async () => {
    const resultado = await provisionarFuncionario(pool, {
      nome: 'Longo',
      login: `teste-prov-${'x'.repeat(60)}`,
      senha: 'senha-forte-123',
    });

    expect(resultado).toMatchObject({ status: 'dados_invalidos' });
  });

  test('com login já existente, avisa e mantém a senha original da conta', async () => {
    await provisionarFuncionario(pool, { nome: 'Original', login: 'teste-prov-dup', senha: 'senha-original-1' });

    const resultado = await provisionarFuncionario(pool, {
      nome: 'Intrusa',
      login: 'teste-prov-dup',
      senha: 'senha-diferente-2',
    });

    expect(resultado).toEqual({ status: 'login_existente', login: 'teste-prov-dup' });
    const salvo = await findFuncionarioByLogin(pool, 'teste-prov-dup');
    expect(salvo?.nome).toBe('Original');
    await expect(verifyPassword(salvo!.senha_hash, 'senha-original-1')).resolves.toBe(true);
  });
});
