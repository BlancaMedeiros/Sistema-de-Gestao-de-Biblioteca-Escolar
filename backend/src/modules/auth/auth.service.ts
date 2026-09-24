import type { Pool } from 'mysql2/promise';

import { findFuncionarioByLogin } from './funcionarios.repository.js';
import { verifyPassword } from './password.js';

export interface FuncionarioAutenticado {
  id: number;
  nome: string;
  login: string;
}

export async function autenticar(pool: Pool, login: string, senha: string): Promise<FuncionarioAutenticado | null> {
  const funcionario = await findFuncionarioByLogin(pool, login);

  if (!funcionario || !funcionario.ativo) {
    return null;
  }

  const senhaValida = await verifyPassword(funcionario.senha_hash, senha);

  if (!senhaValida) {
    return null;
  }

  return { id: funcionario.id, nome: funcionario.nome, login: funcionario.login };
}
