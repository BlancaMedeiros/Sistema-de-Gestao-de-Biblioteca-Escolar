import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../../config/database.js';
import { ErroApi, erroValidacao } from '../../http/erros.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { provisionarFuncionario } from './provisionar-funcionario.js';
import { SENHA_MINIMA } from './password.js';
import { camposContatoFuncionario, obterPerfilFuncionario } from './perfil-funcionario.js';

export const funcionariosRouter = Router();
const cadastroSchema = z.object({
  nome: z.string().trim().min(1).max(120),
  login: z.string().trim().min(1).max(60).regex(/^\S+$/, 'O login não pode conter espaços.'),
  senha: z.string().min(SENHA_MINIMA).max(1024),
  ...camposContatoFuncionario,
});
/**
 * @openapi
 * /funcionarios:
 *   post:
 *     summary: Funcionário autenticado cadastra outro funcionário com o mesmo nível de acesso.
 *     description: Cria conta para entrar no sistema, com ID gerado pelo backend. Login é o nome de acesso único; senha é o segredo, com mínimo de oito caracteres. Escolha cadastro mínimo ou com contatos; ambos dispensam vínculo com leitor. Após criar, use POST /auth/login para entrar com a nova conta. O cadastro não troca a sessão atual.
 *     tags: [Funcionários]
 *     security: [{ sessao: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/FuncionarioEntrada' }
 *           examples:
 *             minimo: { $ref: '#/components/examples/FuncionarioMinimo' }
 *             comContatos: { $ref: '#/components/examples/FuncionarioCompleto' }
 *     responses:
 *       201:
 *         description: Conta criada; nunca retorna senha ou hash.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data: { $ref: '#/components/schemas/FuncionarioPerfil' }
 *       401: { $ref: '#/components/responses/SemSessao' }
 *       404: { $ref: '#/components/responses/UsuarioNaoEncontrado' }
 *       409: { $ref: '#/components/responses/CadastroFuncionarioConflito' }
 *       422: { $ref: '#/components/responses/DadosInvalidos' }
 */
funcionariosRouter.post('/funcionarios', requireAuth, async (request, response, next) => {
  const parsed = cadastroSchema.safeParse(request.body);
  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }
  try {
    const resultado = await provisionarFuncionario(pool, parsed.data);
    if (resultado.status === 'login_existente')
      throw new ErroApi(409, 'LOGIN_DUPLICADO', 'Este login já está cadastrado.');
    if (resultado.status === 'dados_invalidos')
      throw new ErroApi(422, 'DADOS_INVALIDOS', 'Confira os dados informados.', {
        corpo: resultado.erros,
      });
    response.status(201).json({ data: await obterPerfilFuncionario(pool, resultado.id) });
  } catch (erro) {
    next(erro);
  }
});
