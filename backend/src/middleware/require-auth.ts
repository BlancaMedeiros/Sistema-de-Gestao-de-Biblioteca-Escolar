import type { NextFunction, Request, Response } from 'express';

export function requireAuth(request: Request, response: Response, next: NextFunction): void {
  if (!request.session.funcionarioId) {
    response.status(401).json({
      error: { code: 'NAO_AUTENTICADO', message: 'Sessão ausente ou expirada.' },
    });
    return;
  }

  next();
}
