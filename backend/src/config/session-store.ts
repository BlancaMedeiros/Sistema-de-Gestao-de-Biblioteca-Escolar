import { Store, type SessionData } from 'express-session';
import type { Pool, RowDataPacket } from 'mysql2/promise';

const DURACAO_PADRAO_MS = 24 * 60 * 60 * 1000;

interface SessaoRow extends RowDataPacket {
  dados: SessionData;
  expira_em: Date;
}

function calcularExpiracao(session: SessionData): Date {
  const expiresCookie = (session.cookie as { expires?: Date | string | null }).expires;

  return expiresCookie ? new Date(expiresCookie) : new Date(Date.now() + DURACAO_PADRAO_MS);
}

// Store de sessão persistido no MySQL: substitui o MemoryStore padrão do
// express-session, que perde todas as sessões a cada reinício/nova
// instância do backend (inadequado para produção, inclusive no Cloud Run).
export class MySqlSessionStore extends Store {
  constructor(private readonly pool: Pool) {
    super();
  }

  override get(sid: string, callback: (err: unknown, session?: SessionData | null) => void): void {
    this.pool
      .query<SessaoRow[]>('SELECT dados, expira_em FROM sessoes WHERE id = ?', [sid])
      .then(([rows]) => {
        const linha = rows[0];

        if (!linha || linha.expira_em.getTime() <= Date.now()) {
          callback(null, null);
          return;
        }

        callback(null, linha.dados);
      })
      .catch((error: unknown) => callback(error));
  }

  override set(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    const expiraEm = calcularExpiracao(session);

    this.pool
      .query(
        'INSERT INTO sessoes (id, dados, expira_em) VALUES (?, ?, ?) ' +
          'ON DUPLICATE KEY UPDATE dados = VALUES(dados), expira_em = VALUES(expira_em)',
        [sid, JSON.stringify(session), expiraEm],
      )
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override destroy(sid: string, callback?: (err?: unknown) => void): void {
    this.pool
      .query('DELETE FROM sessoes WHERE id = ?', [sid])
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }

  override touch(sid: string, session: SessionData, callback?: (err?: unknown) => void): void {
    const expiraEm = calcularExpiracao(session);

    this.pool
      .query('UPDATE sessoes SET expira_em = ? WHERE id = ?', [expiraEm, sid])
      .then(() => callback?.())
      .catch((error: unknown) => callback?.(error));
  }
}
