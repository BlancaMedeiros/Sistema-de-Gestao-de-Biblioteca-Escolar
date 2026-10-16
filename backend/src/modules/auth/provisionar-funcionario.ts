import type { Pool } from 'mysql2/promise';
import { z } from 'zod';
import { emTransacao } from '../../db/transacao.js';

import { createFuncionario, findFuncionarioByLogin } from './funcionarios.repository.js';
import {
  camposContatoFuncionario,
  tratarConflitoVinculo,
  validarVinculoLeitor,
} from './perfil-funcionario.js';
import { hashPassword, SENHA_MINIMA } from './password.js';

// Limites das colunas em database/migrations/0001_create_funcionarios.sql.
const NOME_MAXIMO = 120;
const LOGIN_MAXIMO = 60;

export interface DadosNovoFuncionario {
  nome: string;
  login: string;
  senha: string;
  email?: string | null;
  telefone?: string | null;
  usuarioId?: number | null;
}

export type ResultadoProvisionamento =
  | { status: 'criado'; id: number; login: string }
  | { status: 'login_existente'; login: string }
  | { status: 'dados_invalidos'; erros: string[] };

function validar(nome: string, login: string, senha: string): string[] {
  const erros: string[] = [];

  if (!nome) erros.push('Informe o nome.');
  if (nome.length > NOME_MAXIMO) erros.push(`O nome pode ter no máximo ${NOME_MAXIMO} caracteres.`);
  if (!login) erros.push('Informe o login.');
  if (/\s/.test(login)) erros.push('O login não pode conter espaços.');
  if (login.length > LOGIN_MAXIMO)
    erros.push(`O login pode ter no máximo ${LOGIN_MAXIMO} caracteres.`);
  if (senha.length < SENHA_MINIMA)
    erros.push(`A senha precisa ter pelo menos ${SENHA_MINIMA} caracteres.`);

  return erros;
}

// Cadastra um funcionário com senha escolhida por quem roda o comando — para
// produção, ao contrário da seed de desenvolvimento. Nunca altera uma conta
// existente: login repetido é recusado.
export async function provisionarFuncionario(
  pool: Pool,
  dados: DadosNovoFuncionario,
): Promise<ResultadoProvisionamento> {
  const nome = dados.nome.trim();
  const login = dados.login.trim();
  const erros = validar(nome, login, dados.senha);
  const contato = z.object(camposContatoFuncionario).safeParse(dados);
  if (!contato.success) erros.push('Confira o e-mail, telefone e vínculo do leitor.');

  if (erros.length > 0) {
    return { status: 'dados_invalidos', erros };
  }

  try {
    const senhaHash = await hashPassword(dados.senha);
    const criado = await emTransacao(pool, async (conexao) => {
      await validarVinculoLeitor(conexao, dados.usuarioId);
      return createFuncionario(conexao, { nome, login, senhaHash, ...contato.data });
    });

    return { status: 'criado', id: criado.id, login: criado.login };
  } catch (error) {
    if (
      (error as { code?: string }).code === 'ER_DUP_ENTRY' &&
      (await findFuncionarioByLogin(pool, login))
    ) {
      return { status: 'login_existente', login };
    }

    return tratarConflitoVinculo(error);
  }
}
