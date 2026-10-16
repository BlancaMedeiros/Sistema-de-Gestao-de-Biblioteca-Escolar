import type { RowDataPacket } from 'mysql2/promise';
import type { Banco } from '../../db/transacao.js';
import { termoLike } from '../../http/erros.js';

export type StatusEmprestimo = 'Em Andamento' | 'Atrasado' | 'Devolvido';
export interface EmprestimoRow extends RowDataPacket {
  id: number;
  livroId: number;
  livroTitulo: string;
  usuarioId: number;
  usuarioNome: string;
  funcionarioId: number;
  dataEmprestimo: string;
  devolucaoPrevista: string;
  devolucaoReal: string | null;
  devolvidoPor: number | null;
  quantidadeRenovacoes: number;
}
export function statusEmprestimo(
  emprestimo: Pick<EmprestimoRow, 'devolucaoReal' | 'devolucaoPrevista'>,
  hoje: string,
): StatusEmprestimo {
  return emprestimo.devolucaoReal
    ? 'Devolvido'
    : emprestimo.devolucaoPrevista < hoje
      ? 'Atrasado'
      : 'Em Andamento';
}
export const paraEmprestimoApi = (linha: EmprestimoRow, hoje: string) => ({
  ...linha,
  status: statusEmprestimo(linha, hoje),
});

const selecao = `SELECT e.id, e.livro_id AS livroId, l.titulo AS livroTitulo,
  e.usuario_id AS usuarioId, u.nome AS usuarioNome, e.funcionario_id AS funcionarioId,
  DATE_FORMAT(e.data_emprestimo, '%Y-%m-%d') AS dataEmprestimo,
  DATE_FORMAT(e.devolucao_prevista, '%Y-%m-%d') AS devolucaoPrevista,
  DATE_FORMAT(e.devolucao_real, '%Y-%m-%d') AS devolucaoReal,
  e.devolvido_por AS devolvidoPor, e.quantidade_renovacoes AS quantidadeRenovacoes
  FROM emprestimos e JOIN livros l ON l.id = e.livro_id JOIN usuarios u ON u.id = e.usuario_id`;

export async function buscarEmprestimo(
  banco: Banco,
  id: number,
  bloquear = false,
): Promise<EmprestimoRow | null> {
  const [linhas] = await banco.query<EmprestimoRow[]>(
    `${selecao} WHERE e.id = ?${bloquear ? ' FOR UPDATE' : ''}`,
    [id],
  );
  return linhas[0] ?? null;
}
export interface FiltroEmprestimos {
  busca?: string;
  usuarioId?: number;
  livroId?: number;
  status?: StatusEmprestimo | 'Abertos';
  vencimentoDe?: string;
  vencimentoAte?: string;
  page: number;
  pageSize: number;
}
export function filtroEmprestimos(filtro: FiltroEmprestimos, hoje: string) {
  const clausulas: string[] = [];
  const valores: unknown[] = [];
  if (filtro.usuarioId) {
    clausulas.push('e.usuario_id = ?');
    valores.push(filtro.usuarioId);
  }
  if (filtro.livroId) {
    clausulas.push('e.livro_id = ?');
    valores.push(filtro.livroId);
  }
  if (filtro.status === 'Devolvido') clausulas.push('e.devolucao_real IS NOT NULL');
  else if (filtro.status) {
    clausulas.push('e.devolucao_real IS NULL');
    if (filtro.status !== 'Abertos') {
      clausulas.push(`e.devolucao_prevista ${filtro.status === 'Atrasado' ? '<' : '>='} ?`);
      valores.push(hoje);
    }
  }
  if (filtro.vencimentoDe) {
    clausulas.push('e.devolucao_prevista >= ?');
    valores.push(filtro.vencimentoDe);
  }
  if (filtro.vencimentoAte) {
    clausulas.push('e.devolucao_prevista <= ?');
    valores.push(filtro.vencimentoAte);
  }
  if (filtro.busca) {
    clausulas.push(
      "(l.titulo LIKE ? ESCAPE '!' OR u.nome LIKE ? ESCAPE '!' OR u.matricula LIKE ? ESCAPE '!')",
    );
    valores.push(...Array(3).fill(termoLike(filtro.busca)));
  }
  return { where: clausulas.length ? `WHERE ${clausulas.join(' AND ')}` : '', valores };
}
export async function listarEmprestimos(banco: Banco, filtro: FiltroEmprestimos, hoje: string) {
  const { where, valores } = filtroEmprestimos(filtro, hoje);
  const [contagem] = await banco.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM emprestimos e JOIN livros l ON l.id = e.livro_id JOIN usuarios u ON u.id = e.usuario_id ${where}`,
    valores,
  );
  const [linhas] = await banco.query<EmprestimoRow[]>(
    `${selecao} ${where} ORDER BY e.criado_em DESC, e.id DESC LIMIT ? OFFSET ?`,
    [...valores, filtro.pageSize, (filtro.page - 1) * filtro.pageSize],
  );
  return {
    data: linhas.map((linha) => paraEmprestimoApi(linha, hoje)),
    pagination: { page: filtro.page, pageSize: filtro.pageSize, total: Number(contagem[0].total) },
  };
}
export async function resumoUsuario(banco: Banco, usuarioId: number, hoje: string) {
  const [linhas] = await banco.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total,
    COALESCE(SUM(devolucao_real IS NULL), 0) AS abertos,
    COALESCE(SUM(devolucao_real IS NULL AND devolucao_prevista < ?), 0) AS atrasados
    FROM emprestimos WHERE usuario_id = ?`,
    [hoje, usuarioId],
  );
  return {
    totalEmprestimos: Number(linhas[0].total),
    emprestimosAtivos: Number(linhas[0].abertos),
    atrasados: Number(linhas[0].atrasados),
  };
}
