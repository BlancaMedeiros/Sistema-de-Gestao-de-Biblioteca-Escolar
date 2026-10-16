import type { NextFunction, Request, Response } from 'express';
import { pool } from '../config/database.js';
import { findFuncionarioById } from '../modules/auth/funcionarios.repository.js';

export async function requireAuth(
  request: Request,
  response: Response,
  next: NextFunction,
): Promise<void> {
  if (!request.session.funcionarioId) {
    response.status(401).json({
      error: { code: 'NAO_AUTENTICADO', message: 'Sessão ausente ou expirada.' },
    });
    return;
  }

  try {
    const funcionario = await findFuncionarioById(pool, request.session.funcionarioId);
    if (!funcionario?.ativo) {
      await new Promise<void>((resolve, reject) => {
        request.session.destroy((erro) => (erro ? reject(erro) : resolve()));
      });
      response
        .status(401)
        .json({ error: { code: 'NAO_AUTENTICADO', message: 'Sessão ausente ou expirada.' } });
      return;
    }
    next();
  } catch (erro) {
    next(erro);
  }
}
