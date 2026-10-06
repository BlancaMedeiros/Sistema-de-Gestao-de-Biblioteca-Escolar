import { Router } from 'express';
import { z } from 'zod';

import { pool } from '../../config/database.js';
import { NOME_COOKIE_SESSAO, opcoesCookieSessao } from '../../config/session.js';
import { destroyOtherSessions } from '../../config/session-store.js';
import { requireAuth } from '../../middleware/require-auth.js';
import { alterarSenha, autenticar } from './auth.service.js';
import { findFuncionarioById, updateFuncionarioNome } from './funcionarios.repository.js';
import { SENHA_MINIMA } from './password.js';

export const authRouter = Router();

const loginSchema = z.object({
  login: z.string().trim().min(1),
  senha: z.string().min(1),
});

const atualizarPerfilSchema = z.object({
  nome: z.string().trim().min(1),
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
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [login, senha]
 *             properties:
 *               login:
 *                 type: string
 *                 example: ana.bibliotecaria
 *               senha:
 *                 type: string
 *                 format: password
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
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Campos obrigatórios ausentes.
 *         content:
 *           application/json:
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

    await new Promise<void>((resolve, reject) => {
      request.session.regenerate((error) => (error ? reject(error) : resolve()));
    });

    request.session.funcionarioId = funcionario.id;

    response.status(200).json({ data: funcionario });
  } catch (error) {
    next(error);
  }
});

/**
 * @openapi
 * /auth/logout:
 *   post:
 *     summary: Encerra a sessão atual.
 *     tags: [Auth]
 *     responses:
 *       204:
 *         description: Sessão encerrada.
 *       401:
 *         description: Sessão ausente ou expirada.
 *         content:
 *           application/json:
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
 *     tags: [Auth]
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
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.get('/me', requireAuth, async (request, response, next) => {
  try {
    const funcionario = await findFuncionarioById(pool, request.session.funcionarioId as number);

    if (!funcionario || !funcionario.ativo) {
      request.session.destroy(() => undefined);
      response.status(401).json({
        error: { code: 'NAO_AUTENTICADO', message: 'Sessão ausente ou expirada.' },
      });
      return;
    }

    response.status(200).json({
      data: { id: funcionario.id, nome: funcionario.nome, login: funcionario.login },
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
 *     description: Hoje só permite alterar o nome. Login e senha têm rotas próprias.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [nome]
 *             properties:
 *               nome:
 *                 type: string
 *                 example: Ana Bibliotecária
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
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Nome ausente ou vazio.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 */
authRouter.patch('/me', requireAuth, async (request, response, next) => {
  const parsed = atualizarPerfilSchema.safeParse(request.body);

  if (!parsed.success) {
    response.status(422).json({
      error: {
        code: 'DADOS_INVALIDOS',
        message: 'Informe um nome válido.',
        fields: parsed.error.flatten().fieldErrors,
      },
    });
    return;
  }

  try {
    const atualizado = await updateFuncionarioNome(
      pool,
      request.session.funcionarioId as number,
      parsed.data.nome,
    );

    response.status(200).json({
      data: { id: atualizado.id, nome: atualizado.nome, login: atualizado.login },
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
 *     description: Invalida as demais sessões do funcionário; a sessão atual continua válida.
 *     tags: [Auth]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [senhaAtual, novaSenha]
 *             properties:
 *               senhaAtual:
 *                 type: string
 *                 format: password
 *               novaSenha:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *     responses:
 *       204:
 *         description: Senha alterada.
 *       401:
 *         description: Sessão ausente/expirada, ou senha atual incorreta.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Erro'
 *       422:
 *         description: Nova senha ausente ou menor que 8 caracteres.
 *         content:
 *           application/json:
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
    const resultado = await alterarSenha(pool, funcionarioId, parsed.data.senhaAtual, parsed.data.novaSenha);

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
