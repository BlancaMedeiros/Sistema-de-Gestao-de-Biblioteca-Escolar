import type { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise';

export interface FuncionarioRow extends RowDataPacket {
  id: number;
  nome: string;
  login: string;
  senha_hash: string;
  ativo: number;
}

export async function findFuncionarioById(pool: Pool, id: number): Promise<FuncionarioRow | null> {
  const [rows] = await pool.query<FuncionarioRow[]>(
    'SELECT id, nome, login, senha_hash, ativo FROM funcionarios WHERE id = ? LIMIT 1',
    [id],
  );

  return rows[0] ?? null;
}

export async function findFuncionarioByLogin(pool: Pool, login: string): Promise<FuncionarioRow | null> {
  const [rows] = await pool.query<FuncionarioRow[]>(
    'SELECT id, nome, login, senha_hash, ativo FROM funcionarios WHERE login = ? LIMIT 1',
    [login],
  );

  return rows[0] ?? null;
}

export async function createFuncionario(
  pool: Pool,
  dados: { nome: string; login: string; senhaHash: string },
): Promise<FuncionarioRow> {
  const [resultado] = await pool.query<ResultSetHeader>(
    'INSERT INTO funcionarios (nome, login, senha_hash) VALUES (?, ?, ?)',
    [dados.nome, dados.login, dados.senhaHash],
  );

  const criado = await findFuncionarioById(pool, resultado.insertId);

  if (!criado) {
    throw new Error('Falha ao criar funcionário: registro não encontrado após a inserção.');
  }

  return criado;
}
