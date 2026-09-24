import type { Pool } from 'mysql2/promise';

import { createFuncionario, findFuncionarioByLogin } from '../modules/auth/funcionarios.repository.js';
import { hashPassword } from '../modules/auth/password.js';

export interface FuncionarioSeed {
  nome: string;
  login: string;
  senha: string;
}

export interface ResultadoSeed {
  login: string;
  status: 'criado' | 'ja_existia';
  id: number;
}

// Idempotente por login: nunca apaga ou sobrescreve um funcionário
// existente, só cria os que ainda faltam. Reexecutar com uma senha
// diferente no seed não altera a senha de um funcionário já criado.
export async function seedFuncionarios(pool: Pool, seeds: FuncionarioSeed[]): Promise<ResultadoSeed[]> {
  const resultados: ResultadoSeed[] = [];

  for (const seed of seeds) {
    const existente = await findFuncionarioByLogin(pool, seed.login);

    if (existente) {
      resultados.push({ login: seed.login, status: 'ja_existia', id: existente.id });
      continue;
    }

    const senhaHash = await hashPassword(seed.senha);
    const criado = await createFuncionario(pool, { nome: seed.nome, login: seed.login, senhaHash });
    resultados.push({ login: seed.login, status: 'criado', id: criado.id });
  }

  return resultados;
}
