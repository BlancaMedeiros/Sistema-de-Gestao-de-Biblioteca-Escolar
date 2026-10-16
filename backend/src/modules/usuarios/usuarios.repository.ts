import type { ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database.js';
import { emTransacao, type Banco } from '../../db/transacao.js';
import { ErroApi, codigoMysql, termoLike } from '../../http/erros.js';
import { hojeEscola } from '../../utils/datas.js';

export interface UsuarioDados {
  nome: string;
  matricula: string;
  email: string | null;
  telefone: string | null;
  turma: string | null;
  tipo: 'Aluno' | 'Professor' | 'Bibliotecário';
  status: 'Ativo' | 'Inativo';
}
export interface UsuarioRow extends RowDataPacket, UsuarioDados {
  id: number;
  dataCadastro: string;
}
const colunas = `id, nome, matricula, email, telefone, turma, tipo,
  CASE WHEN ativo = 1 THEN 'Ativo' ELSE 'Inativo' END AS status,
  DATE_FORMAT(data_cadastro, '%Y-%m-%d') AS dataCadastro`;

export async function buscarUsuario(banco: Banco, id: number): Promise<UsuarioRow> {
  const [linhas] = await banco.query<UsuarioRow[]>(`SELECT ${colunas} FROM usuarios WHERE id = ?`, [
    id,
  ]);
  if (!linhas[0]) throw new ErroApi(404, 'USUARIO_NAO_ENCONTRADO', 'Leitor não encontrado.');
  return linhas[0];
}
export interface FiltroUsuarios {
  busca?: string;
  tipo?: UsuarioDados['tipo'];
  status?: UsuarioDados['status'];
  page: number;
  pageSize: number;
}
export async function listarUsuarios(filtro: FiltroUsuarios) {
  return emTransacao(
    pool,
    async (conexao) => {
      const clausulas: string[] = [];
      const valores: unknown[] = [];
      if (filtro.busca) {
        clausulas.push(
          "(nome LIKE ? ESCAPE '!' OR matricula LIKE ? ESCAPE '!' OR email LIKE ? ESCAPE '!')",
        );
        valores.push(...Array(3).fill(termoLike(filtro.busca)));
      }
      if (filtro.tipo) {
        clausulas.push('tipo = ?');
        valores.push(filtro.tipo);
      }
      if (filtro.status) {
        clausulas.push('ativo = ?');
        valores.push(filtro.status === 'Ativo' ? 1 : 0);
      }
      const where = clausulas.length ? `WHERE ${clausulas.join(' AND ')}` : '';
      const [contagem] = await conexao.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS total FROM usuarios ${where}`,
        valores,
      );
      const [data] = await conexao.query<UsuarioRow[]>(
        `SELECT ${colunas} FROM usuarios ${where} ORDER BY nome, id LIMIT ? OFFSET ?`,
        [...valores, filtro.pageSize, (filtro.page - 1) * filtro.pageSize],
      );
      return {
        data,
        pagination: {
          page: filtro.page,
          pageSize: filtro.pageSize,
          total: Number(contagem[0].total),
        },
      };
    },
    'REPEATABLE READ',
  );
}
function valoresUsuario(dados: UsuarioDados) {
  return [
    dados.nome,
    dados.matricula,
    dados.email,
    dados.telefone,
    dados.turma,
    dados.tipo,
    dados.status === 'Ativo' ? 1 : 0,
  ];
}
function tratarMatricula(erro: unknown): never {
  if (codigoMysql(erro) === 'ER_DUP_ENTRY')
    throw new ErroApi(
      409,
      'MATRICULA_DUPLICADA',
      'Esta matrícula já pertence a um leitor, inclusive inativo.',
    );
  throw erro;
}
export async function cadastrarUsuario(dados: UsuarioDados) {
  try {
    const [resultado] = await pool.query<ResultSetHeader>(
      'INSERT INTO usuarios (nome, matricula, email, telefone, turma, tipo, ativo, data_cadastro) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [...valoresUsuario(dados), hojeEscola()],
    );
    return buscarUsuario(pool, resultado.insertId);
  } catch (erro) {
    return tratarMatricula(erro);
  }
}
export async function editarUsuario(id: number, alteracoes: Partial<UsuarioDados>) {
  try {
    return await emTransacao(pool, async (conexao) => {
      const [existentes] = await conexao.query<UsuarioRow[]>(
        `SELECT ${colunas} FROM usuarios WHERE id = ? FOR UPDATE`,
        [id],
      );
      if (!existentes[0])
        throw new ErroApi(404, 'USUARIO_NAO_ENCONTRADO', 'Leitor não encontrado.');
      const dados = { ...existentes[0], ...alteracoes };
      if (dados.status === 'Inativo') {
        const [abertos] = await conexao.query<RowDataPacket[]>(
          'SELECT COUNT(*) AS total FROM emprestimos WHERE usuario_id = ? AND devolucao_real IS NULL',
          [id],
        );
        if (Number(abertos[0].total))
          throw new ErroApi(
            409,
            'USUARIO_COM_EMPRESTIMOS',
            'Devolva os empréstimos abertos antes de inativar o leitor.',
          );
      }
      await conexao.query(
        'UPDATE usuarios SET nome = ?, matricula = ?, email = ?, telefone = ?, turma = ?, tipo = ?, ativo = ? WHERE id = ?',
        [...valoresUsuario(dados), id],
      );
      return buscarUsuario(conexao, id);
    });
  } catch (erro) {
    return tratarMatricula(erro);
  }
}
