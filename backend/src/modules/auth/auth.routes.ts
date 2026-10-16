import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../../config/database.js';
import { NOME_COOKIE_SESSAO, opcoesCookieSessao } from '../../config/session.js';
import { destroyOtherSessions } from '../../config/session-store.js';
import { erroValidacao } from '../../http/erros.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { alterarSenha, autenticar } from './auth.service.js';
import {
  editarPerfilFuncionario,
  obterPerfilFuncionario,
  perfilEdicaoSchema,
} from './perfil-funcionario.js';
import { SENHA_MINIMA } from './password.js';

export const authRouter = Router();

const loginSchema = z.object({
  login: z.string().trim().min(1),
  senha: z.string().min(1),
});

const alterarSenhaSchema = z.object({
  senhaAtual: z.string().min(1),
  novaSenha: z.string().min(SENHA_MINIMA),
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Autentica um funcionário e inicia uma sessão.
 *     description: Use uma conta já cadastrada. Login identifica a conta e senha autentica. O navegador guarda o cookie na mesma origem; não preencha Authorize. O exemplo local depende da seed e da senha ainda estar válida.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/LoginEntrada' }
 *           examples:
 *             contaLocal: { $ref: '#/components/examples/LoginLocal' }
 *             contaCriada: { $ref: '#/components/examples/LoginContaCriada' }
 *     responses:
 *       200:
 *         description: Sessão criada; cookie de sessão devolvido no header Set-Cookie.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FuncionarioPerfil'
 *       401:
 *         description: Login ou senha incorretos.
 *         content:
 *           application/json:
 *             example: { error: { code: CREDENCIAIS_INVALIDAS, message: 'Login ou senha incorretos.' } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Campos obrigatórios ausentes.
 *         content:
 *           application/json:
 *             example: { error: { code: DADOS_INVALIDOS, message: 'Informe login e senha.', fields: { login: ['Informe o login.'], senha: ['Informe a senha.'] } } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.post('/auth/login', async (request, response, next) => {
  const parsed = loginSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(422).json({
      error: {
        code: 'DADOS_INVALIDOS',
        message: 'Informe login e senha.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  try {
    const funcionario = await autenticar(pool, parsed.data.login, parsed.data.senha);

    if (!funcionario) {
      response.status(401).json({
        error: { code: 'CREDENCIAIS_INVALIDAS', message: 'Login ou senha incorretos.' },
      });
      return;
    }

    const perfil = await obterPerfilFuncionario(pool, funcionario.id);
    await new Promise<void>((resolve, reject) => {
      request.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    request.session.funcionarioId = funcionario.id;

    response.status(200).json({ data: perfil });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Encerra a sessão atual.
 *     description: Destrói a sessão e limpa o cookie. Retorna 204 sem JSON; a próxima consulta protegida deve receber 401. Não exige corpo.
 *     tags: [Auth]
 *     security: [{ sessao: [] }]
 *     responses:
 *       204:
 *         description: Sessão encerrada.
 *       401:
 *         description: Sessão ausente ou expirada.
 *         content:
 *           application/json:
 *             example: { error: { code: NAO_AUTENTICADO, message: 'Sessão ausente ou expirada.' } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.post('/auth/logout', requireAuth, (request, response, next) => {
  request.session.destroy((error) => {
    if (error) {
      next(error);
      return;
    }

    response.clearCookie(NOME_COOKIE_SESSAO, opcoesCookieSessao);
    response.status(204).send();
  });
});

/**
 * @openapi
 * /me:
 *   get:
 *     summary: Retorna o perfil do funcionário autenticado.
 *     description: Use após login ou recarregar a aplicação para verificar a sessão. O ID pertence à conta; matrícula e indicadores pessoais vêm somente de leitor explicitamente vinculado, ficando null/zero sem vínculo. Senha e hash nunca são retornados.
 *     tags: [Auth]
 *     security: [{ sessao: [] }]
 *     responses:
 *       200:
 *         description: Perfil da sessão atual.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FuncionarioPerfil'
 *       401:
 *         description: Sessão ausente ou expirada.
 *         content:
 *           application/json:
 *             example: { error: { code: NAO_AUTENTICADO, message: 'Sessão ausente ou expirada.' } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    response.status(200).json({
      data: await obterPerfilFuncionario(pool, request.session.funcionarioId!),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /me:
 *   patch:
 *     summary: Atualiza os dados permitidos do próprio perfil.
 *     description: Edição parcial de nome, email, telefone e vínculo explícito usuarioId. Login, cargo, matrícula e contadores não são editáveis aqui. Senha usa PUT /me/senha.
 *     tags: [Auth]
 *     security: [{ sessao: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PerfilEdicao'
 *           examples:
 *             contatos: { $ref: '#/components/examples/PerfilContatos' }
 *             removerContato: { $ref: '#/components/examples/PerfilLimparContato' }
 *     responses:
 *       200:
 *         description: Perfil atualizado.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   $ref: '#/components/schemas/FuncionarioPerfil'
 *       401:
 *         description: Sessão ausente ou expirada.
 *         content:
 *           application/json:
 *             example: { error: { code: NAO_AUTENTICADO, message: 'Sessão ausente ou expirada.' } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       404: { $ref: '#/components/responses/UsuarioNaoEncontrado' }
 *       409: { $ref: '#/components/responses/PerfilConflito' }
 *       422:
 *         description: Campos inválidos ou ausência de campos editáveis.
 *         content:
 *           application/json:
 *             example: { error: { code: DADOS_INVALIDOS, message: 'Confira os dados informados.', fields: { email: ['Informe um e-mail válido.'] } } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.patch('/me', requireAuth, async (request, response, next) => {
  const parsed = perfilEdicaoSchema.safeParse(request.body);

  if (!parsed.success) {
    erroValidacao(response, parsed.error);
    return;
  }

  try {
    response.status(200).json({
      data: await editarPerfilFuncionario(pool, request.session.funcionarioId!, parsed.data),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /me/senha:
 *   put:
 *     summary: Altera a própria senha.
 *     description: Exige senha atual correta e nova senha com pelo menos oito caracteres. Retorna 204 sem JSON; a sessão atual continua válida e as demais sessões dessa conta recebem 401. Não use a conta compartilhada para testar troca de senha.
 *     tags: [Auth]
 *     security: [{ sessao: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/TrocaSenhaEntrada' }
 *           examples:
 *             trocarSenha: { $ref: '#/components/examples/TrocaSenha' }
 *     responses:
 *       204:
 *         description: Senha alterada.
 *       401:
 *         description: Sessão ausente/expirada, ou senha atual incorreta.
 *         content:
 *           application/json:
 *             examples:
 *               senhaAtualIncorreta:
 *                 summary: Senha atual não confere
 *                 value: { error: { code: SENHA_ATUAL_INVALIDA, message: 'Senha atual incorreta.' } }
 *               semSessao:
 *                 summary: Sessão ausente ou expirada
 *                 value: { error: { code: NAO_AUTENTICADO, message: 'Sessão ausente ou expirada.' } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Nova senha ausente ou menor que 8 caracteres.
 *         content:
 *           application/json:
 *             example: { error: { code: DADOS_INVALIDOS, message: 'Informe a senha atual e uma nova senha com pelo menos 8 caracteres.', fields: { novaSenha: ['Use pelo menos oito caracteres.'] } } }
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.put('/me/senha', requireAuth, async (request, response, next) => {
  const parsed = alterarSenhaSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(422).json({
      error: {
        code: 'DADOS_INVALIDOS',
        message: 'Informe a senha atual e uma nova senha com pelo menos 8 caracteres.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  try {
    const funcionarioId = request.session.funcionarioId as number;
    const resultado = await alterarSenha(
      pool,
      funcionarioId,
      parsed.data.senhaAtual,
      parsed.data.novaSenha,
    );

    if (resultado === 'senha_atual_invalida') {
      response.status(401).json({
        error: { code: 'SENHA_ATUAL_INVALIDA', message: 'Senha atual incorreta.' },
      });
      return;
    }

    await destroyOtherSessions(pool, funcionarioId, request.session.id);

    response.status(204).send();
  } catch (error) {
    next(error);
  }
});
