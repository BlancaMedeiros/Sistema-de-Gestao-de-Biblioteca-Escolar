import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import {
  buscaSchema,
  erroValidacao,
  lerId,
  paginacaoSchema,
  textoOpcional,
} from '../../http/erros.js';
import { requireAuth } from '../../middleware/require-auth.js';
import {
  buscarUsuario,
  cadastrarUsuario,
  editarUsuario,
  listarUsuarios,
} from './usuarios.repository.js';

export const usuariosRouter = Router();
usuariosRouter.use('/usuarios', requireAuth);
const tipoSchema = z.enum(['Aluno', 'Professor', 'Bibliotecário']);
const statusSchema = z.enum(['Ativo', 'Inativo']);
const campos = {
  nome: z.string().trim().min(1).max(160),
  matricula: z.string().trim().min(1).max(60),
  email: textoOpcional(254).refine(
    (valor) => !valor || z.email().safeParse(valor).success,
    'Informe um e-mail válido.',
  ),
  telefone: textoOpcional(30),
  turma: textoOpcional(100),
  tipo: tipoSchema,
  status: statusSchema,
};
const cadastroSchema = z.object({ ...campos, status: statusSchema.default('Ativo') });
const edicaoSchema = z
  .object(campos)
  .partial()
  .refine((dados) => Object.keys(dados).length > 0, 'Informe ao menos um campo editável.');
const listaSchema = z.object({
  busca: buscaSchema,
  tipo: tipoSchema.optional(),
  status: statusSchema.optional(),
  ...paginacaoSchema,
});

/**
 * @openapi
 * /usuarios:
 *   get:
 *     summary: Lista leitores, inclusive inativos, com busca, filtros e paginação.
 *     tags: [Leitores]
 *     security: [{ sessao: [] }]
 *     parameters:
 *       - { in: query, name: busca, schema: { type: string, maxLength: 100 } }
 *       - { in: query, name: tipo, schema: { type: string, enum: [Aluno, Professor, Bibliotecário] } }
 *       - { in: query, name: status, schema: { type: string, enum: [Ativo, Inativo] } }
 *       - { $ref: '#/components/parameters/Page' }
 *       - { $ref: '#/components/parameters/PageSize' }
 *     responses:
 *       200: { $ref: '#/components/responses/ListaUsuarios' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 *   post:
 *     summary: Cadastra um leitor; não cria conta de acesso.
 *     tags: [Leitores]
 *     security: [{ sessao: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UsuarioEntrada' }
 *     responses:
 *       201: { $ref: '#/components/responses/UsuarioEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       409: { $ref: '#/components/responses/ConflitoNegocio' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
usuariosRouter.get('/usuarios', async (request, response, next) => {
  const parsed = listaSchema.safeParse(request.query);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    response.json(await listarUsuarios(parsed.data));
  } catch (erro) {
    next(erro);
  }
});
usuariosRouter.post('/usuarios', async (request, response, next) => {
  const parsed = cadastroSchema.safeParse(request.body);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const dados = parsed.data;
    response.status(201).json({
      data: await cadastrarUsuario({
        ...dados,
        email: dados.email ?? null,
        telefone: dados.telefone ?? null,
        turma: dados.turma ?? null,
      }),
    });
  } catch (erro) {
    next(erro);
  }
});

/**
 * @openapi
 * /usuarios/{id}:
 *   get:
 *     summary: Consulta um leitor, inclusive inativo.
 *     tags: [Leitores]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/RecursoId' }]
 *     responses:
 *       200: { $ref: '#/components/responses/UsuarioEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *   patch:
 *     summary: Edita, reativa ou inativa leitor; inativação exige ausência de empréstimos abertos.
 *     tags: [Leitores]
 *     security: [{ sessao: [] }]
 *     parameters: [{ $ref: '#/components/parameters/RecursoId' }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/UsuarioEdicao' }
 *     responses:
 *       200: { $ref: '#/components/responses/UsuarioEncontrado' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/NaoEncontrado' }
 *       409: { $ref: '#/components/responses/ConflitoNegocio' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
usuariosRouter.get('/usuarios/:id', async (request, response, next) => {
  try {
    response.json({
      data: await buscarUsuario(pool, lerId(request.params.id, 'USUARIO_NAO_ENCONTRADO', 'Leitor')),
    });
  } catch (erro) {
    next(erro);
  }
});
usuariosRouter.patch('/usuarios/:id', async (request, response, next) => {
  try {
    const id = lerId(request.params.id, 'USUARIO_NAO_ENCONTRADO', 'Leitor');
    const parsed = edicaoSchema.safeParse(request.body);
    if (!parsed.success) {
      erroValidacao(response, parsed.error);
      return;
    }
    response.json({ data: await editarUsuario(id, parsed.data) });
  } catch (erro) {
    next(erro);
  }
});
