import type { SessionData } from 'express-session';
import { afterEach, describe, expect, test } from 'vitest';

import { pool } from './database.js';
import { MySqlSessionStore } from './session-store.js';

function callbackToPromise<T>(run: (callback: (err: unknown, result?: T) => void) => void): Promise<T | undefined> {
  return new Promise((resolve, reject) => {
    run((err, result) => (err ? reject(err) : resolve(result)));
  });
}

describe('MySqlSessionStore', () => {
  const store = new MySqlSessionStore(pool);
  const sidsCriados: string[] = [];

  afterEach(async () => {
    for (const sid of sidsCriados) {
      await pool.query('DELETE FROM sessoes WHERE id = ?', [sid]);
    }
    sidsCriados.length = 0;
  });

  test('set seguido de get devolve os mesmos dados da sessão', async () => {
    const sid = 'teste-store-round-trip';
    sidsCriados.push(sid);
    const sessao = {
      cookie: { originalMaxAge: 60_000, expires: new Date(Date.now() + 60_000) },
      funcionarioId: 42,
    } as unknown as SessionData;

    await callbackToPromise((cb) => store.set(sid, sessao, cb));
    const lida = await callbackToPromise<SessionData | null>((cb) => store.get(sid, cb));

    expect(lida).toMatchObject({ funcionarioId: 42 });
  });

  test('get para um sid desconhecido resolve com null, sem erro', async () => {
    const lida = await callbackToPromise<SessionData | null>((cb) => store.get('teste-store-inexistente', cb));

    expect(lida).toBeNull();
  });

  test('destroy remove a sessão', async () => {
    const sid = 'teste-store-destroy';
    sidsCriados.push(sid);
    const sessao = {
      cookie: { originalMaxAge: 60_000, expires: new Date(Date.now() + 60_000) },
    } as unknown as SessionData;

    await callbackToPromise((cb) => store.set(sid, sessao, cb));
    await callbackToPromise((cb) => store.destroy(sid, cb));
    const lida = await callbackToPromise<SessionData | null>((cb) => store.get(sid, cb));

    expect(lida).toBeNull();
  });

  test('get trata uma sessão expirada como inexistente', async () => {
    const sid = 'teste-store-expirada';
    sidsCriados.push(sid);
    await pool.query('INSERT INTO sessoes (id, dados, expira_em) VALUES (?, ?, ?)', [
      sid,
      JSON.stringify({ funcionarioId: 1 }),
      new Date(Date.now() - 60_000),
    ]);

    const lida = await callbackToPromise<SessionData | null>((cb) => store.get(sid, cb));

    expect(lida).toBeNull();
  });
});
