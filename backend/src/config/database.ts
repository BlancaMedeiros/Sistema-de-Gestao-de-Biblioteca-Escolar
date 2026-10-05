import mysql, { type PoolOptions, type RowDataPacket } from 'mysql2/promise';

import { env, type DatabaseEnv } from './env.js';

export function buildPoolOptions(database: DatabaseEnv): PoolOptions {
  const connection = database.socketPath
    ? { socketPath: database.socketPath }
    : { host: database.host, port: database.port };

  return {
    ...connection,
    database: database.name,
    user: database.user,
    password: database.password,
    ...(database.sslCa ? { ssl: { ca: database.sslCa, rejectUnauthorized: true } } : {}),
    waitForConnections: true,
    connectionLimit: database.connectionLimit,
    enableKeepAlive: true,
  };
}

export const pool = mysql.createPool(buildPoolOptions(env.database));

export async function databaseIsReady(): Promise<boolean> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT 1 AS ready');

  return rows[0]?.ready === 1;
}
