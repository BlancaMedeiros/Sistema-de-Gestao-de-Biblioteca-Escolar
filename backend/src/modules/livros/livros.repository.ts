import type { Pool, ResultSetHeader } from 'mysql2/promise';
import { emTransacao } from '../../db/transacao.js';
import { ErroApi } from '../../http/erros.js';

import { paraLivroApi, type LivroDados, type LivroRow } from './livro.js';

const colunasBase = `id, titulo, autor, isbn, categoria, ano_publicacao,
  quantidade_total, quantidade_manutencao, estante, prateleira`;
const colunas = `${colunasBase}, (SELECT COUNT(*) FROM emprestimos e
  WHERE e.livro_id = livros.id AND e.devolucao_real IS NULL) AS quantidade_emprestada`;

export async function listarLivros(pool: Pool, busca: string): Promise<LivroRow[]> {
  // ESCAPE explícito evita depender de NO_BACKSLASH_ESCAPES/sql_mode.
  const termo = `%${busca.replace(/[!%_]/g, (caractere) => `!${caractere}`)}%`;
  const filtro = busca
    ? `AND (titulo LIKE ? ESCAPE '!' OR autor LIKE ? ESCAPE '!' OR isbn LIKE ? ESCAPE '!'
        OR estante LIKE ? ESCAPE '!' OR prateleira LIKE ? ESCAPE '!')`
    : '';
  const [linhas] = await pool.query<LivroRow[]>(
    `SELECT ${colunas} FROM livros WHERE ativo = 1 ${filtro} ORDER BY titulo, id`,
    busca ? [termo, termo, termo, termo, termo] : [],
  );
  return linhas;
}

export async function buscarLivroPorId(pool: Pool, id: number): Promise<LivroRow | null> {
  const [linhas] = await pool.query<LivroRow[]>(
    `SELECT ${colunas} FROM livros WHERE id = ? AND ativo = 1`,
    [id],
  );
  return linhas[0] ?? null;
}

function valoresLivro(dados: LivroDados) {
  return [
    dados.titulo,
    dados.autor,
    dados.isbn,
    dados.categoria,
    dados.anoPublicacao,
    dados.quantidadeTotal,
    dados.quantidadeManutencao,
    dados.estante,
    dados.prateleira,
  ];
}

export async function inserirLivro(pool: Pool, dados: LivroDados): Promise<LivroRow> {
  const [resultado] = await pool.query<ResultSetHeader>(
    `INSERT INTO livros (titulo, autor, isbn, categoria, ano_publicacao,
      quantidade_total, quantidade_manutencao, estante, prateleira)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    valoresLivro(dados),
  );
  const criado = await buscarLivroPorId(pool, resultado.insertId);
  if (!criado) throw new Error('Livro não encontrado após a inserção.');
  return criado;
}

export type ResultadoAtualizacao =
  | { tipo: 'nao_encontrado' }
  | { tipo: 'quantidades_invalidas'; campo: 'quantidadeTotal' | 'quantidadeManutencao' }
  | { tipo: 'atualizado'; livro: LivroRow };

export async function atualizarLivro(
  pool: Pool,
  id: number,
  alteracoes: Partial<LivroDados>,
): Promise<ResultadoAtualizacao> {
  return emTransacao(pool, async (conexao): Promise<ResultadoAtualizacao> => {
    // A leitura e a gravação usam a mesma transação para não perder PATCHes
    // concorrentes nem validar as quantidades contra valores desatualizados.
    const [linhas] = await conexao.query<LivroRow[]>(
      `SELECT ${colunasBase} FROM livros WHERE id = ? AND ativo = 1 FOR UPDATE`,
      [id],
    );
    if (!linhas[0]) {
      return { tipo: 'nao_encontrado' };
    }
    const [contagem] = await conexao.query<LivroRow[]>(
      'SELECT COUNT(*) AS quantidade_emprestada FROM emprestimos WHERE livro_id = ? AND devolucao_real IS NULL',
      [id],
    );
    linhas[0].quantidade_emprestada = Number(contagem[0].quantidade_emprestada);
    const dados = { ...paraLivroApi(linhas[0]), ...alteracoes };
    if (dados.quantidadeManutencao + linhas[0].quantidade_emprestada > dados.quantidadeTotal) {
      return {
        tipo: 'quantidades_invalidas',
        campo:
          alteracoes.quantidadeTotal !== undefined ? 'quantidadeTotal' : 'quantidadeManutencao',
      };
    }
    await conexao.query(
      `UPDATE livros SET titulo = ?, autor = ?, isbn = ?, categoria = ?, ano_publicacao = ?,
        quantidade_total = ?, quantidade_manutencao = ?, estante = ?, prateleira = ? WHERE id = ?`,
      [...valoresLivro(dados), id],
    );
    const [atualizados] = await conexao.query<LivroRow[]>(
      `SELECT ${colunas} FROM livros WHERE id = ?`,
      [id],
    );
    return { tipo: 'atualizado', livro: atualizados[0] };
  });
}

export async function inativarLivro(pool: Pool, id: number): Promise<boolean> {
  return emTransacao(pool, async (conexao) => {
    const [linhas] = await conexao.query<LivroRow[]>(
      'SELECT id FROM livros WHERE id = ? AND ativo = 1 FOR UPDATE',
      [id],
    );
    if (!linhas[0]) return false;
    const [contagem] = await conexao.query<LivroRow[]>(
      'SELECT COUNT(*) AS quantidade_emprestada FROM emprestimos WHERE livro_id = ? AND devolucao_real IS NULL',
      [id],
    );
    if (Number(contagem[0].quantidade_emprestada))
      throw new ErroApi(
        409,
        'LIVRO_COM_EMPRESTIMOS',
        'Devolva os empréstimos abertos antes de inativar o livro.',
      );
    await conexao.query('UPDATE livros SET ativo = 0 WHERE id = ?', [id]);
    return true;
  });
}
