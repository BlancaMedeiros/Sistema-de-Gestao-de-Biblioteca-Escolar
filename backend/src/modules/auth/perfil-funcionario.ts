import type { Pool, RowDataPacket } from 'mysql2/promise';
import { z } from 'zod';
import { emTransacao, type Banco } from '../../db/transacao.js';
import { codigoMysql, ErroApi, idSchema, textoOpcional } from '../../http/erros.js';

export const camposContatoFuncionario = {
  email: textoOpcional(254).refine(
    (valor) => !valor || z.email().safeParse(valor).success,
    'Informe um e-mail válido.',
  ),
  telefone: textoOpcional(30),
  usuarioId: idSchema.nullable().optional(),
};
export const perfilEdicaoSchema = z
  .object({
    nome: z.string().trim().min(1).max(120).optional(),
    ...camposContatoFuncionario,
  })
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo editável.');

export async function obterPerfilFuncionario(banco: Banco, id: number) {
  // usuario_id é uma associação explícita; nunca comparamos os IDs dos cadastros.
  const [linhas] = await banco.query<RowDataPacket[]>(
    `SELECT f.id, f.nome, f.login, f.email, f.telefone, f.usuario_id AS usuarioId, u.matricula,
    (SELECT COUNT(*) FROM emprestimos e WHERE e.usuario_id = f.usuario_id AND e.devolucao_real IS NULL) AS emprestimosAtivos,
    (SELECT COUNT(*) FROM emprestimos e WHERE e.usuario_id = f.usuario_id) AS historicoTotal
    FROM funcionarios f LEFT JOIN usuarios u ON u.id = f.usuario_id
    WHERE f.id = ? AND f.ativo = 1`,
    [id],
  );
  const linha = linhas[0];
  if (!linha) throw new ErroApi(401, 'NAO_AUTENTICADO', 'Sessão ausente ou expirada.');
  return {
    id: Number(linha.id),
    nome: String(linha.nome),
    login: String(linha.login),
    email: linha.email as string | null,
    telefone: linha.telefone as string | null,
    usuarioId: linha.usuarioId === null ? null : Number(linha.usuarioId),
    matricula: linha.matricula as string | null,
    cargo: 'Funcionário autorizado',
    emprestimosAtivos: Number(linha.emprestimosAtivos),
    historicoTotal: Number(linha.historicoTotal),
  };
}

export function tratarConflitoVinculo(erro: unknown): never {
  if (codigoMysql(erro) === 'ER_DUP_ENTRY')
    throw new ErroApi(
      409,
      'LEITOR_JA_VINCULADO',
      'Este leitor já está vinculado a outra conta de funcionário.',
    );
  if (codigoMysql(erro) === 'ER_NO_REFERENCED_ROW_2')
    throw new ErroApi(404, 'USUARIO_NAO_ENCONTRADO', 'Leitor não encontrado.');
  throw erro;
}

export async function validarVinculoLeitor(banco: Banco, usuarioId: number | null | undefined) {
  if (usuarioId == null) return;
  const [linhas] = await banco.query<RowDataPacket[]>(
    'SELECT id FROM usuarios WHERE id = ? FOR UPDATE',
    [usuarioId],
  );
  if (!linhas[0]) throw new ErroApi(404, 'USUARIO_NAO_ENCONTRADO', 'Leitor não encontrado.');
}

export async function editarPerfilFuncionario(
  pool: Pool,
  id: number,
  dados: z.infer<typeof perfilEdicaoSchema>,
) {
  try {
    return await emTransacao(pool, async (conexao) => {
      // A idempotência das movimentações adquire primeiro um lock compartilhado
      // no funcionário (FK). Travá-lo antes do leitor evita inverter essa ordem.
      await conexao.query('SELECT id FROM funcionarios WHERE id = ? FOR UPDATE', [id]);
      await validarVinculoLeitor(conexao, dados.usuarioId);
      const colunas = {
        nome: 'nome',
        email: 'email',
        telefone: 'telefone',
        usuarioId: 'usuario_id',
      } as const;
      const entradas = Object.entries(dados) as Array<[keyof typeof colunas, unknown]>;
      await conexao.query(
        `UPDATE funcionarios SET ${entradas.map(([chave]) => `${colunas[chave]} = ?`).join(', ')} WHERE id = ? AND ativo = 1`,
        [...entradas.map(([, valor]) => valor), id],
      );
      return obterPerfilFuncionario(conexao, id);
    });
  } catch (erro) {
    return tratarConflitoVinculo(erro);
  }
}
