import mysql, { type RowDataPacket } from 'mysql2/promise';

import { env } from './env.js';

const connection = env.database.socketPath
  ? { socketPath: env.database.socketPath }
  : { host: env.database.host, port: env.database.port };

export const pool = mysql.createPool({
  ...connection,
  database: env.database.name,
  user: env.database.user,
  password: env.database.password,
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
});

export async function databaseIsReady(): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 AS ready');

  return rows[0]?.ready === 1;
}
