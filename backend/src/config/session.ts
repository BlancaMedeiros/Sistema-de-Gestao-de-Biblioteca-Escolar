import session, { type SessionOptions } from 'express-session';

import { pool } from './database.js';
import { env } from './env.js';
import { MySqlSessionStore } from './session-store.js';

declare module 'express-session' {
  interface SessionData {
    funcionarioId?: number;
  }
}

const SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000;

// O Firebase Hosting remove das requisições repassadas ao Cloud Run todos os
// cookies, exceto um chamado exatamente `__session`.
export const NOME_COOKIE_SESSAO = '__session';

// Usadas também no logout, para apagar o cookie com os mesmos atributos.
export const opcoesCookieSessao = {
  path: '/',
  httpOnly: true,
  secure: env.nodeEnv === 'production',
  sameSite: 'lax' as const,
};

export const sessionOptions: SessionOptions = {
  name: NOME_COOKIE_SESSAO,
  secret: env.sessionSecret,
  store: new MySqlSessionStore(pool),
  resave: false,
  saveUninitialized: false,
  cookie: { ...opcoesCookieSessao, maxAge: SESSION_MAX_AGE_MS },
};

export const sessionMiddleware = session(sessionOptions);
