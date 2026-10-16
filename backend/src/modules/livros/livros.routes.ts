import { Router, type Response } from 'express';
import { z } from 'zod';

import { pool } from '../../config/database.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { normalizarIsbn, paraLivroApi } from './livro.js';
import {
  atualizarLivro,
  buscarLivroPorId,
  inativarLivro,
  inserirLivro,
  listarLivros,
} from './livros.repository.js';

export const livrosRouter = Router();
livrosRouter.use('/livros', requireAuth);

const inteiroQuantidade = z.number().int().min(0).max(4_294_967_295);
const textoOpcional = (limite: number) =>
  z
    .string()
    .trim()
    .max(limite)
    .transform((valor) => valor || null)
    .nullable()
    .optional();
const isbnSchema = z
  .string()
  .max(100)
  .nullable()
  .transform((valor, contexto) => {
    try {
      return normalizarIsbn(valor);
    } catch {
      contexto.addIssue({
        code: 'custom',
        message: 'Informe um ISBN de 10 ou 13 caracteres, ou deixe vazio.',
      });
      return z.NEVER;
    }
  })
  .optional();
const campos = {
  titulo: z.string().trim().min(1).max(255),
  autor: z.string().trim().min(1).max(255),
  isbn: isbnSchema,
  categoria: textoOpcional(100),
  anoPublicacao: z
    .number()
    .int()
    .min(1000)
    .refine(
      (ano) => ano <= new Date().getFullYear() + 1,
      'O ano não pode ser posterior ao próximo ano.',
    )
    .nullable()
    .optional(),
  quantidadeTotal: inteiroQuantidade.min(1),
  quantidadeManutencao: inteiroQuantidade,
  estante: textoOpcional(60),
  prateleira: textoOpcional(60),
};
const cadastroSchema = z
  .object({
    ...campos,
    quantidadeManutencao: campos.quantidadeManutencao.default(0),
  })
  .superRefine((dados, contexto) => {
    if (dados.quantidadeManutencao > dados.quantidadeTotal) {
      contexto.addIssue({
        code: 'custom',
        path: ['quantidadeManutencao'],
        message: 'A manutenção não pode exceder o total.',
      });
    }
  });
const edicaoSchema = z
  .object(campos)
  .partial()
  .refine(
    (dados) => Object.values(dados).some((valor) => valor !== undefined),
    'Informe ao menos um campo editável.',
  );
const buscaSchema = z.object({ busca: z.string().trim().max(100).optional() });

function dadosInvalidos(response: Response, fields: Record<string, string[] | undefined>) {
  response
    .status(422)
    .json({ error: { code: 'DADOS_INVALIDOS', message: 'Confira os dados informados.', fields } });
}
function erroValidacao(response: Response, erro: z.ZodError) {
  const erros = erro.flatten();
  dadosInvalidos(response, {
    ...erros.fieldErrors,
    ...(erros.formErrors.length ? { corpo: erros.formErrors } : {}),
  });
}
function naoEncontrado(response: Response) {
  response
    .status(404)
    .json({ error: { code: 'LIVRO_NAO_ENCONTRADO', message: 'Livro não encontrado.' } });
}
function lerId(valor: unknown): number | null {
  if (typeof valor !== 'string' || !/^[1-9]\d*$/.test(valor)) return null;
  const id = Number(valor);
  return Number.isSafeInteger(id) && id <= 4_294_967_295 ? id : null;
}
function responderConflito(response: Response, erro: unknown): boolean {
  if (typeof erro === 'object' && erro !== null && 'code' in erro && erro.code === 'ER_DUP_ENTRY') {
    response.status(409).json({
      error: {
        code: 'ISBN_DUPLICADO',
        message: 'Este ISBN já está cadastrado, inclusive entre livros inativos.',
      },
    });
    return true;
  }
  return false;
}

/**
 * @openapi
 * /livros:
 *   get:
 *     summary: Lista livros ativos, ordenados por título, com busca opcional.
 *     tags: [Livros]
 *     security: [{ sessao: [] }]
 *     parameters:
 *       - in: query
 *         name: busca
 *         description: Texto literal em título, autor, ISBN, estante ou prateleira. Ignora caixa e acentos.
 *         schema: { type: string, maxLength: 100 }
 *     responses:
 *       200:
 *         description: Lista sem paginação, com disponibilidade calculada.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items: { $ref: '#/components/schemas/Livro' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
livrosRouter.get('/livros', async (request, response, next) => {
  const parsed = buscaSchema.safeParse(request.query);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const livros = await listarLivros(pool, parsed.data.busca ?? '');
    response.json({ data: livros.map(paraLivroApi) });
  } catch (erro) {
    next(erro);
  }
});

/**
 * @openapi
 * /livros/{id}:
 *   get:
 *     summary: Consulta um livro ativo.
 *     tags: [Livros]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/LivroId' }]
 *     responses:
 *       200: { $ref: '#/components/responses/LivroEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/LivroNaoEncontrado' }
 */
livrosRouter.get('/livros/:id', async (request, response, next) => {
  const id = lerId(request.params.id);
  if (id === null) {
    naoEncontrado(response);
    return;
  }
  try {
    const livro = await buscarLivroPorId(pool, id);
    if (!livro) {
      naoEncontrado(response);
      return;
    }
    response.json({ data: paraLivroApi(livro) });
  } catch (erro) {
    next(erro);
  }
});

/**
 * @openapi
 * /livros:
 *   post:
 *     summary: Cadastra um livro; ISBN é opcional e único, mesmo entre inativos.
 *     tags: [Livros]
 *     security: [{ sessao: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LivroCadastro' }
 *     responses:
 *       201:
 *         description: Livro criado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/Livro' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       409: { $ref: '#/components/responses/IsbnDuplicado' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
livrosRouter.post('/livros', async (request, response, next) => {
  const parsed = cadastroSchema.safeParse(request.body);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const dados = parsed.data;
    const livro = await inserirLivro(pool, {
      ...dados,
      isbn: dados.isbn ?? null,
      categoria: dados.categoria ?? null,
      anoPublicacao: dados.anoPublicacao ?? null,
      estante: dados.estante ?? null,
      prateleira: dados.prateleira ?? null,
    });
    response.status(201).json({ data: paraLivroApi(livro) });
  } catch (erro) {
    if (!responderConflito(response, erro)) next(erro);
  }
});

/**
 * @openapi
 * /livros/{id}:
 *   patch:
 *     summary: Edita apenas os campos enviados, validando as quantidades finais.
 *     tags: [Livros]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/LivroId' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LivroEdicao' }
 *     responses:
 *       200: { $ref: '#/components/responses/LivroEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/LivroNaoEncontrado' }
 *       409: { $ref: '#/components/responses/IsbnDuplicado' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
livrosRouter.patch('/livros/:id', async (request, response, next) => {
  const id = lerId(request.params.id);
  if (id === null) {
    naoEncontrado(response);
    return;
  }
  const parsed = edicaoSchema.safeParse(request.body);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const resultado = await atualizarLivro(pool, id, parsed.data);
    if (resultado.tipo === 'nao_encontrado') {
      naoEncontrado(response);
      return;
    }
    if (resultado.tipo === 'quantidades_invalidas') {
      dadosInvalidos(response, {
        [resultado.campo]: [
          'O total não pode ser menor que a soma de exemplares emprestados e em manutenção.',
        ],
      });
      return;
    }
    response.json({ data: paraLivroApi(resultado.livro) });
  } catch (erro) {
    if (!responderConflito(response, erro)) next(erro);
  }
});

/**
 * @openapi
 * /livros/{id}:
 *   delete:
 *     summary: Inativa livro sem empréstimos abertos, preservando histórico e reserva do ISBN.
 *     tags: [Livros]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/LivroId' }]
 *     responses:
 *       204: { description: Livro inativado, sem corpo de resposta. }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/LivroNaoEncontrado' }
 *       409: { $ref: '#/components/responses/ConflitoNegocio' }
 */
livrosRouter.delete('/livros/:id', async (request, response, next) => {
  const id = lerId(request.params.id);
  if (id === null) {
    naoEncontrado(response);
    return;
  }
  try {
    if (!(await inativarLivro(pool, id))) {
      naoEncontrado(response);
      return;
    }
    response.status(204).send();
  } catch (erro) {
    next(erro);
  }
});
