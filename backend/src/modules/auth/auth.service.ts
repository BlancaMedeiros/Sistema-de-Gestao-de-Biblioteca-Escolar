import type { Pool } from 'mysql2/promise';

import { findFuncionarioById, findFuncionarioByLogin, updateFuncionarioSenha } from './funcionarios.repository.js';
import { hashPassword, verifyPassword } from './password.js';

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

export type ResultadoAlterarSenha = 'ok' | 'senha_atual_invalida';

export async function alterarSenha(
  pool: Pool,
  funcionarioId: number,
  senhaAtual: string,
  novaSenha: string,
): Promise<ResultadoAlterarSenha> {
  const funcionario = await findFuncionarioById(pool, funcionarioId);

  if (!funcionario) {
    throw new Error(`Funcionário ${funcionarioId} não encontrado ao tentar alterar a senha.`);
  }

  const senhaAtualValida = await verifyPassword(funcionario.senha_hash, senhaAtual);

  if (!senhaAtualValida) {
    return 'senha_atual_invalida';
  }

  const novaSenhaHash = await hashPassword(novaSenha);
  await updateFuncionarioSenha(pool, funcionarioId, novaSenhaHash);

  return 'ok';
}
