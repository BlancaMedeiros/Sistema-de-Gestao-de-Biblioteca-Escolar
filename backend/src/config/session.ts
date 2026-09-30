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

export const sessionOptions: SessionOptions = {
  name: 'biblioteca.sid',
  secret: env.sessionSecret,
  store: new MySqlSessionStore(pool),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: env.nodeEnv === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE_MS,
  },
};

export const sessionMiddleware = session(sessionOptions);
