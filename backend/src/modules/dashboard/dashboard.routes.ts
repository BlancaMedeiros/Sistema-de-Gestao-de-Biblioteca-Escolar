import { Router } from 'express';
import type { RowDataPacket } from 'mysql2/promise';
import { pool } from '../../config/database.js';
import { emTransacao } from '../../db/transacao.js';
import { erroValidacao } from '../../http/erros.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { hojeEscola } from '../../utils/datas.js';
import { listarEmprestimos } from '../emprestimos/emprestimos.repository.js';
import { filtrosSchema } from '../emprestimos/emprestimos.routes.js';

export const dashboardRouter = Router();

/**
 * @openapi
 * /dashboard:
 *   get:
 *     summary: Métricas persistentes, quatro empréstimos recentes e até vinte devoluções previstas para hoje.
 *     description: As consultas usam o mesmo snapshot e data de São Paulo. totalAcervo soma unidades de títulos ativos, inclusive em manutenção; usuariosAtivos conta leitores. emprestimosAtivos inclui atrasados; devolucoesPendentes conta somente atrasados. metricas.devolucoesHoje é o total e devolucoesHoje é uma lista de até vinte. Para consultar todos os vencimentos de hoje, use o relatório com as duas datas iguais a dataReferencia.
 *     tags: [Dashboard]
 *     security: [{ sessao: [] }]
 *     responses:
 *       200:
 *         description: Indicadores, data de referência em São Paulo e listas.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Dashboard' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 * /relatorios/pendencias:
 *   get:
 *     summary: Relatório paginado de empréstimos abertos, com filtro opcional de atrasos e vencimento.
 *     description: Por padrão inclui todos os abertos, tanto em dia quanto atrasados. Use status Atrasado para somente atrasos; Devolvido retorna 422. Para um dia específico, use a mesma data em vencimentoDe e vencimentoAte. Após uma devolução, o registro sai deste relatório e permanece no histórico.
 *     tags: [Relatórios]
 *     security: [{ sessao: [] }]
 *     parameters:
 *       - { $ref: '#/components/parameters/BuscaMovimentacao' }
 *       - { $ref: '#/components/parameters/UsuarioFiltro' }
 *       - { $ref: '#/components/parameters/LivroFiltro' }
 *       - { in: query, name: status, description: 'Somente abertos. Devolvido não é aceito neste relatório.', schema: { type: string, enum: [Abertos, Atrasado, Em Andamento], default: Abertos, example: Abertos } }
 *       - { $ref: '#/components/parameters/VencimentoDe' }
 *       - { $ref: '#/components/parameters/VencimentoAte' }
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/PageSize' }
 *     responses:
 *       200: { $ref: '#/components/responses/ListaEmprestimos' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
dashboardRouter.get('/dashboard', requireAuth, async (_request, response, next) => {
  try {
    const data = await emTransacao(
      pool,
      async (conexao) => {
        const hoje = hojeEscola();
        const [linhas] = await conexao.query<RowDataPacket[]>(
          `SELECT
        (SELECT COALESCE(SUM(quantidade_total), 0) FROM livros WHERE ativo = 1) AS totalAcervo,
        (SELECT COUNT(*) FROM usuarios WHERE ativo = 1) AS usuariosAtivos,
        (SELECT COUNT(*) FROM emprestimos WHERE devolucao_real IS NULL) AS emprestimosAtivos,
        (SELECT COUNT(*) FROM emprestimos WHERE devolucao_real IS NULL AND devolucao_prevista < ?) AS devolucoesPendentes,
        (SELECT COUNT(*) FROM emprestimos WHERE devolucao_real IS NULL AND devolucao_prevista = ?) AS devolucoesHoje`,
          [hoje, hoje],
        );
        const metricas = Object.fromEntries(
          Object.entries(linhas[0]).map(([chave, valor]) => [chave, Number(valor)]),
        );
        const recentes = await listarEmprestimos(conexao, { page: 1, pageSize: 4 }, hoje);
        const devolucoes = await listarEmprestimos(
          conexao,
          { status: 'Abertos', vencimentoDe: hoje, vencimentoAte: hoje, page: 1, pageSize: 20 },
          hoje,
        );
        return {
          dataReferencia: hoje,
          metricas,
          ultimosEmprestimos: recentes.data,
          devolucoesHoje: devolucoes.data,
        };
      },
      'REPEATABLE READ',
    );
    response.json({ data });
  } catch (erro) {
    next(erro);
  }
});
dashboardRouter.get('/relatorios/pendencias', requireAuth, async (request, response, next) => {
  const parsed = filtrosSchema
    .refine((filtro) => filtro.status !== 'Devolvido', {
      path: ['status'],
      message: 'O relatório lista somente empréstimos abertos.',
    })
    .safeParse(request.query);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    response.json(
      await emTransacao(
        pool,
        (conexao) =>
          listarEmprestimos(
            conexao,
            { ...parsed.data, status: parsed.data.status ?? 'Abertos' },
            hojeEscola(),
          ),
        'REPEATABLE READ',
      ),
    );
  } catch (erro) {
    next(erro);
  }
});
