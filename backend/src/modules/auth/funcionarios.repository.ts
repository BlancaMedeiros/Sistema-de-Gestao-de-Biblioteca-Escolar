import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import type { Banco } from '../../db/transacao.js';

export interface FuncionarioRow extends RowDataPacket {
  id: number;
  nome: string;
  login: string;
  senha_hash: string;
  ativo: number;
}

export async function findFuncionarioById(pool: Banco, id: number): Promise<FuncionarioRow | null> {
  const [rows] = await pool.query<FuncionarioRow[]>(
    'SELECT id, nome, login, senha_hash, ativo FROM funcionarios WHERE id = ? LIMIT 1',
    [id],
  );

  return rows[0] ?? null;
}

export async function findFuncionarioByLogin(
  pool: Pool,
  login: string,
): Promise<FuncionarioRow | null> {
  const [rows] = await pool.query<FuncionarioRow[]>(
    'SELECT id, nome, login, senha_hash, ativo FROM funcionarios WHERE login = ? LIMIT 1',
    [login],
  );

  return rows[0] ?? null;
}

export async function createFuncionario(
  pool: Banco,
  dados: {
    nome: string;
    login: string;
    senhaHash: string;
    email?: string | null;
    telefone?: string | null;
    usuarioId?: number | null;
  },
): Promise<FuncionarioRow> {
  const [resultado] = await pool.query<ResultSetHeader>(
    'INSERT INTO funcionarios (nome, login, senha_hash, email, telefone, usuario_id) VALUES (?, ?, ?, ?, ?, ?)',
    [
      dados.nome,
      dados.login,
      dados.senhaHash,
      dados.email ?? null,
      dados.telefone ?? null,
      dados.usuarioId ?? null,
    ],
  );

  const criado = await findFuncionarioById(pool, resultado.insertId);

  if (!criado) {
    throw new Error('Falha ao criar funcionário: registro não encontrado após a inserção.');
  }

  return criado;
}

export async function updateFuncionarioNome(
  pool: Pool,
  id: number,
  nome: string,
): Promise<FuncionarioRow> {
  await pool.query('UPDATE funcionarios SET nome = ? WHERE id = ?', [nome, id]);

  const atualizado = await findFuncionarioById(pool, id);

  if (!atualizado) {
    throw new Error('Falha ao atualizar funcionário: registro não encontrado após a atualização.');
  }

  return atualizado;
}

export async function updateFuncionarioSenha(
  pool: Pool,
  id: number,
  senhaHash: string,
): Promise<void> {
  await pool.query('UPDATE funcionarios SET senha_hash = ? WHERE id = ?', [senhaHash, id]);
}
