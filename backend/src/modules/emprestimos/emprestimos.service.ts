import { createHash } from 'node:crypto';
import type { PoolConnection, ResultSetHeader, RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database.js';
import { emTransacao } from '../../db/transacao.js';
import { ErroApi } from '../../http/erros.js';
import { hojeEscola, somarDias } from '../../utils/datas.js';
import {
  buscarEmprestimo,
  paraEmprestimoApi,
  type EmprestimoRow,
} from './emprestimos.repository.js';

export const REGRAS_EMPRESTIMOS = {
  prazoDias: 7,
  maximoAbertosPorLeitor: 3,
  maximoRenovacoes: 2,
} as const;
type RespostaOperacao = { status: number; body: { data: ReturnType<typeof paraEmprestimoApi> } };

async function comIdempotencia(
  funcionarioId: number,
  chave: string,
  operacao: string,
  dados: unknown,
  executar: (conexao: PoolConnection) => Promise<RespostaOperacao>,
): Promise<RespostaOperacao> {
  const hash = createHash('sha256').update(JSON.stringify(dados)).digest('hex');
  return emTransacao(pool, async (conexao) => {
    // A chave e o efeito são gravados na mesma transação. O upsert espera
    // uma requisição concorrente com a mesma chave terminar antes da leitura.
    await conexao.query(
      `INSERT INTO idempotencia (funcionario_id, operacao, chave, hash_requisicao)
      VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE id = id`,
      [funcionarioId, operacao, chave, hash],
    );
    const [registros] = await conexao.query<RowDataPacket[]>(
      `SELECT hash_requisicao, http_status, resposta FROM idempotencia
      WHERE funcionario_id = ? AND operacao = ? AND chave = ? FOR UPDATE`,
      [funcionarioId, operacao, chave],
    );
    const registro = registros[0];
    if (registro.hash_requisicao !== hash)
      throw new ErroApi(
        409,
        'CHAVE_IDEMPOTENCIA_REUTILIZADA',
        'Use uma nova Idempotency-Key para uma intenção diferente.',
      );
    if (registro.http_status !== null)
      return {
        status: Number(registro.http_status),
        body:
          typeof registro.resposta === 'string' ? JSON.parse(registro.resposta) : registro.resposta,
      };
    const resposta = await executar(conexao);
    await conexao.query(
      `UPDATE idempotencia SET http_status = ?, resposta = ?
      WHERE funcionario_id = ? AND operacao = ? AND chave = ?`,
      [resposta.status, JSON.stringify(resposta.body), funcionarioId, operacao, chave],
    );
    return resposta;
  });
}

async function travarParticipantes(conexao: PoolConnection, usuarioId: number, livroId: number) {
  // Ordem única em criar/renovar/devolver: leitor -> livro -> empréstimo.
  const [usuarios] = await conexao.query<RowDataPacket[]>(
    'SELECT id, ativo FROM usuarios WHERE id = ? FOR UPDATE',
    [usuarioId],
  );
  if (!usuarios[0]) throw new ErroApi(404, 'USUARIO_NAO_ENCONTRADO', 'Leitor não encontrado.');
  const [livros] = await conexao.query<RowDataPacket[]>(
    'SELECT id, ativo, quantidade_total, quantidade_manutencao FROM livros WHERE id = ? FOR UPDATE',
    [livroId],
  );
  if (!livros[0]) throw new ErroApi(404, 'LIVRO_NAO_ENCONTRADO', 'Livro não encontrado.');
  return { usuario: usuarios[0], livro: livros[0] };
}

async function validarLeitor(
  conexao: PoolConnection,
  usuarioId: number,
  ativo: number,
  hoje: string,
  novo: boolean,
) {
  if (!ativo) throw new ErroApi(409, 'USUARIO_INATIVO', 'O leitor precisa estar ativo.');
  const [abertos] = await conexao.query<RowDataPacket[]>(
    'SELECT devolucao_prevista < ? AS atrasado FROM emprestimos WHERE usuario_id = ? AND devolucao_real IS NULL',
    [hoje, usuarioId],
  );
  if (abertos.some((linha) => Number(linha.atrasado)))
    throw new ErroApi(
      409,
      'USUARIO_COM_ATRASOS',
      'Devolva os empréstimos atrasados antes de emprestar ou renovar.',
    );
  if (novo && abertos.length >= REGRAS_EMPRESTIMOS.maximoAbertosPorLeitor)
    throw new ErroApi(409, 'LIMITE_EMPRESTIMOS', 'O leitor já possui três empréstimos abertos.');
}

export async function criarEmprestimo(
  funcionarioId: number,
  chave: string,
  dados: { livroId: number; usuarioId: number },
) {
  return comIdempotencia(funcionarioId, chave, 'emprestimos:criar', dados, async (conexao) => {
    const hoje = hojeEscola();
    const { usuario, livro } = await travarParticipantes(conexao, dados.usuarioId, dados.livroId);
    await validarLeitor(conexao, dados.usuarioId, usuario.ativo, hoje, true);
    if (!livro.ativo) throw new ErroApi(409, 'LIVRO_INATIVO', 'O livro está inativo.');
    const [contagem] = await conexao.query<RowDataPacket[]>(
      'SELECT COUNT(*) AS total FROM emprestimos WHERE livro_id = ? AND devolucao_real IS NULL',
      [dados.livroId],
    );
    if (livro.quantidade_total - livro.quantidade_manutencao - Number(contagem[0].total) < 1)
      throw new ErroApi(409, 'LIVRO_INDISPONIVEL', 'Não há exemplar disponível deste livro.');
    const [resultado] = await conexao.query<ResultSetHeader>(
      `INSERT INTO emprestimos
      (livro_id, usuario_id, funcionario_id, data_emprestimo, devolucao_prevista) VALUES (?, ?, ?, ?, ?)`,
      [
        dados.livroId,
        dados.usuarioId,
        funcionarioId,
        hoje,
        somarDias(hoje, REGRAS_EMPRESTIMOS.prazoDias),
      ],
    );
    return {
      status: 201,
      body: {
        data: paraEmprestimoApi((await buscarEmprestimo(conexao, resultado.insertId))!, hoje),
      },
    };
  });
}

async function mutarEmprestimo(
  funcionarioId: number,
  chave: string,
  id: number,
  acao: 'renovar' | 'devolver',
  executar: (
    conexao: PoolConnection,
    emprestimo: EmprestimoRow,
    usuarioAtivo: number,
    hoje: string,
  ) => Promise<void>,
) {
  return comIdempotencia(funcionarioId, chave, `emprestimos:${id}:${acao}`, {}, async (conexao) => {
    const [referencias] = await conexao.query<RowDataPacket[]>(
      'SELECT usuario_id, livro_id FROM emprestimos WHERE id = ?',
      [id],
    );
    if (!referencias[0])
      throw new ErroApi(404, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
    const { usuario } = await travarParticipantes(
      conexao,
      referencias[0].usuario_id,
      referencias[0].livro_id,
    );
    const emprestimo = (await buscarEmprestimo(conexao, id, true))!;
    if (emprestimo.devolucaoReal)
      throw new ErroApi(409, 'EMPRESTIMO_DEVOLVIDO', 'O empréstimo já foi devolvido.');
    const hoje = hojeEscola();
    await executar(conexao, emprestimo, usuario.ativo, hoje);
    return {
      status: 200,
      body: { data: paraEmprestimoApi((await buscarEmprestimo(conexao, id))!, hoje) },
    };
  });
}
export function renovarEmprestimo(funcionarioId: number, chave: string, id: number) {
  return mutarEmprestimo(
    funcionarioId,
    chave,
    id,
    'renovar',
    async (conexao, emprestimo, ativo, hoje) => {
      await validarLeitor(conexao, emprestimo.usuarioId, ativo, hoje, false);
      if (emprestimo.quantidadeRenovacoes >= REGRAS_EMPRESTIMOS.maximoRenovacoes)
        throw new ErroApi(409, 'LIMITE_RENOVACOES', 'O empréstimo já foi renovado duas vezes.');
      const prazo = somarDias(emprestimo.devolucaoPrevista, REGRAS_EMPRESTIMOS.prazoDias);
      const numero = emprestimo.quantidadeRenovacoes + 1;
      await conexao.query(
        'INSERT INTO renovacoes (emprestimo_id, funcionario_id, numero, prazo_anterior, novo_prazo) VALUES (?, ?, ?, ?, ?)',
        [id, funcionarioId, numero, emprestimo.devolucaoPrevista, prazo],
      );
      await conexao.query(
        'UPDATE emprestimos SET devolucao_prevista = ?, quantidade_renovacoes = ? WHERE id = ?',
        [prazo, numero, id],
      );
    },
  );
}
export function devolverEmprestimo(funcionarioId: number, chave: string, id: number) {
  return mutarEmprestimo(
    funcionarioId,
    chave,
    id,
    'devolver',
    async (conexao, _emprestimo, _ativo, hoje) => {
      await conexao.query(
        'UPDATE emprestimos SET devolucao_real = ?, devolvido_por = ? WHERE id = ?',
        [hoje, funcionarioId, id],
      );
    },
  );
}
