import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { emTransacao } from '../../db/transacao.js';
import {
  ErroApi,
  buscaSchema,
  erroValidacao,
  idSchema,
  lerId,
  numeroQuery,
  paginacaoSchema,
} from '../../http/erros.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { dataSchema, hojeEscola } from '../../utils/datas.js';
import { buscarUsuario } from '../usuarios/usuarios.repository.js';
import {
  buscarEmprestimo,
  listarEmprestimos,
  paraEmprestimoApi,
  resumoUsuario,
} from './emprestimos.repository.js';
import { criarEmprestimo, devolverEmprestimo, renovarEmprestimo } from './emprestimos.service.js';

export const emprestimosRouter = Router();
emprestimosRouter.use('/emprestimos', requireAuth);
export const filtrosSchema = z
  .object({
    busca: buscaSchema,
    livroId: numeroQuery(4_294_967_295).optional(),
    usuarioId: numeroQuery(4_294_967_295).optional(),
    status: z.enum(['Em Andamento', 'Atrasado', 'Devolvido', 'Abertos']).optional(),
    vencimentoDe: dataSchema.optional(),
    vencimentoAte: dataSchema.optional(),
    ...paginacaoSchema,
  })
  .refine(
    (filtro) =>
      !filtro.vencimentoDe || !filtro.vencimentoAte || filtro.vencimentoDe <= filtro.vencimentoAte,
    { path: ['vencimentoAte'], message: 'O fim do intervalo não pode ser anterior ao início.' },
  );
const cadastroSchema = z.object({ livroId: idSchema, usuarioId: idSchema });
const acaoSchema = z.object({}).strict().default({});
function lerChave(valor: string | undefined): string {
  if (!valor || !/^[A-Za-z0-9._:-]{1,100}$/.test(valor))
    throw new ErroApi(
      422,
      'DADOS_INVALIDOS',
      'Informe uma Idempotency-Key por intenção de operação.',
      {
        'Idempotency-Key': [
          'Use de 1 a 100 letras ASCII, números, ponto, hífen, sublinhado ou dois-pontos.',
        ],
      },
    );
  return valor;
}

/**
 * @openapi
 * /emprestimos:
 *   get:
 *     summary: Lista empréstimos; atraso é calculado pela data atual de São Paulo.
 *     description: Ordena pelos mais recentes por criação/ID. Sem status, inclui devolvidos; Abertos inclui em dia e atrasados. Combine filtros e percorra pagination.total. As datas de vencimento são inclusivas.
 *     tags: [Empréstimos]
 *     security: [{ sessao: [] }]
 *     parameters:
 *       - { $ref: '#/components/parameters/BuscaMovimentacao' }
 *       - { $ref: '#/components/parameters/UsuarioFiltro' }
 *       - { $ref: '#/components/parameters/LivroFiltro' }
 *       - { $ref: '#/components/parameters/StatusEmprestimo' }
 *       - { $ref: '#/components/parameters/VencimentoDe' }
 *       - { $ref: '#/components/parameters/VencimentoAte' }
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/PageSize' }
 *     responses:
 *       200: { $ref: '#/components/responses/ListaEmprestimos' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 *   post:
 *     summary: Empresta uma unidade; prazo de 7 dias e máximo de 3 empréstimos abertos por leitor sem atrasos.
 *     description: Primeiro cadastre/consulte livro e leitor ativos. Substitua os IDs do exemplo pelos reais e gere uma Idempotency-Key nova. Servidor define hoje, prazo de sete dias, funcionário da sessão e saldo. Estoque, limite ou atraso podem retornar 409 sem efetivar a operação.
 *     tags: [Empréstimos]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/IdempotencyKey' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/EmprestimoEntrada' }
 *           examples:
 *             emprestar: { $ref: '#/components/examples/EmprestimoCadastro' }
 *     responses:
 *       201: { $ref: '#/components/responses/EmprestimoEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { $ref: '#/components/responses/ConflitoNegocio' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
emprestimosRouter.get('/emprestimos', async (request, response, next) => {
  const parsed = filtrosSchema.safeParse(request.query);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    response.json(
      await emTransacao(
        pool,
        (conexao) => listarEmprestimos(conexao, parsed.data, hojeEscola()),
        'REPEATABLE READ',
      ),
    );
  } catch (erro) {
    next(erro);
  }
});
emprestimosRouter.post('/emprestimos', async (request, response, next) => {
  const parsed = cadastroSchema.safeParse(request.body);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const resultado = await criarEmprestimo(
      request.session.funcionarioId!,
      lerChave(request.get('Idempotency-Key')),
      parsed.data,
    );
    response.status(resultado.status).json(resultado.body);
  } catch (erro) {
    next(erro);
  }
});

/**
 * @openapi
 * /emprestimos/{id}:
 *   get:
 *     summary: Consulta um empréstimo e seu status atual.
 *     description: Use para reler o estado depois de uma escrita ou retentativa. Status considera o dia atual de São Paulo; nomes e localização refletem os cadastros atuais, inclusive após inativação do livro.
 *     tags: [Empréstimos]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/EmprestimoId' }]
 *     responses:
 *       200: { $ref: '#/components/responses/EmprestimoEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 * /emprestimos/{id}/renovacoes:
 *   post:
 *     summary: Renova por mais 7 dias sobre o prazo atual, até duas vezes; leitor não pode ter atrasos.
 *     description: Informe o ID do empréstimo no caminho e chave nova no header. Corpo pode ser omitido ou {}. Não envie dias ou datas. O prazo cresce sobre o vencimento anterior; repetir a mesma chave retorna o corpo original sem outra renovação. Consulte GET para o estado atual.
 *     tags: [Empréstimos]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/EmprestimoId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AcaoEmprestimo' }
 *           examples:
 *             semCampos: { $ref: '#/components/examples/AcaoEmprestimo' }
 *     responses:
 *       200: { $ref: '#/components/responses/EmprestimoRenovado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { $ref: '#/components/responses/RenovacaoConflito' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 * /emprestimos/{id}/devolucao:
 *   post:
 *     summary: Devolve na data atual de São Paulo; aceita atrasados e preserva o histórico.
 *     description: Informe ID no caminho e chave nova no header. Corpo pode ser omitido ou {}. O servidor registra data/operador e recompõe uma unidade. Repetir a chave original retorna o mesmo 200; tentar devolver novamente com chave diferente retorna 409 EMPRESTIMO_DEVOLVIDO.
 *     tags: [Empréstimos]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/EmprestimoId' }, { $ref: '#/components/parameters/IdempotencyKey' }]
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AcaoEmprestimo' }
 *           examples:
 *             semCampos: { $ref: '#/components/examples/AcaoEmprestimo' }
 *     responses:
 *       200: { $ref: '#/components/responses/EmprestimoDevolvido' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { $ref: '#/components/responses/DevolucaoConflito' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
emprestimosRouter.get('/emprestimos/:id', async (request, response, next) => {
  try {
    const linha = await buscarEmprestimo(
      pool,
      lerId(request.params.id, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo'),
    );
    if (!linha) throw new ErroApi(404, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo não encontrado.');
    response.json({ data: paraEmprestimoApi(linha, hojeEscola()) });
  } catch (erro) {
    next(erro);
  }
});
for (const [caminho, executar] of [
  ['renovacoes', renovarEmprestimo],
  ['devolucao', devolverEmprestimo],
] as const) {
  emprestimosRouter.post(`/emprestimos/:id/${caminho}`, async (request, response, next) => {
    const parsed = acaoSchema.safeParse(request.body);
    if (!parsed.success) {
      erroValidacao(response, parsed.error);
      return;
    }
    try {
      const resultado = await executar(
        request.session.funcionarioId!,
        lerChave(request.get('Idempotency-Key')),
        lerId(request.params.id, 'EMPRESTIMO_NAO_ENCONTRADO', 'Empréstimo'),
      );
      response.status(resultado.status).json(resultado.body);
    } catch (erro) {
      next(erro);
    }
  });
}

/**
 * @openapi
 * /usuarios/{id}/emprestimos:
 *   get:
 *     summary: Histórico paginado do leitor, inclusive inativo, com resumo de abertos e atrasados.
 *     description: Inclui devolvidos e preserva histórico de livros/leitores inativos. pagination.total considera os filtros; resumo sempre considera todos os empréstimos desse leitor, não apenas a página/filtro. Use o ID do leitor no caminho, não o da conta de funcionário.
 *     tags: [Leitores]
 *     security: [{ sessao: [] }]
 *     parameters:
 *       - { $ref: '#/components/parameters/UsuarioId' }
 *       - { $ref: '#/components/parameters/StatusEmprestimo' }
 *       - { $ref: '#/components/parameters/VencimentoDe' }
 *       - { $ref: '#/components/parameters/VencimentoAte' }
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/PageSize' }
 *     responses:
 *       200: { $ref: '#/components/responses/HistoricoUsuario' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/UsuarioNaoEncontrado' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
emprestimosRouter.get('/usuarios/:id/emprestimos', requireAuth, async (request, response, next) => {
  const parsed = filtrosSchema.safeParse(request.query);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const id = lerId(request.params.id, 'USUARIO_NAO_ENCONTRADO', 'Leitor');
    const resultado = await emTransacao(
      pool,
      async (conexao) => {
        await buscarUsuario(conexao, id);
        const hoje = hojeEscola();
        return {
          ...(await listarEmprestimos(conexao, { ...parsed.data, usuarioId: id }, hoje)),
          resumo: await resumoUsuario(conexao, id, hoje),
        };
      },
      'REPEATABLE READ',
    );
    response.json(resultado);
  } catch (erro) {
    next(erro);
  }
});
