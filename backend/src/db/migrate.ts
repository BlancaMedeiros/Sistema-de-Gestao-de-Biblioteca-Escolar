import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import type { Pool, RowDataPacket } from 'mysql2/promise';

import { selectPendingMigrations } from './migrations.js';

async function ensureMigrationsTable(pool: Pool): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      nome VARCHAR(255) NOT NULL,
      aplicada_em DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_schema_migrations_nome UNIQUE (nome)
    ) ENGINE=InnoDB
  `);
}

async function fetchAppliedMigrations(pool: Pool): Promise<string[]> {
  const [rows] = await pool.query<RowDataPacket[]>('SELECT nome FROM schema_migrations');

  return rows.map((row) => row.nome as string);
}

// Cada arquivo de migration deve conter um único comando DDL: o pool não
// habilita `multipleStatements`, para não abrir essa porta nas consultas
// parametrizadas do restante da aplicação.
export async function runMigrations(pool: Pool, migrationsDir: string): Promise<string[]> {
  await ensureMigrationsTable(pool);

  const available = (await readdir(migrationsDir)).filter((file) => file.endsWith('.sql'));
  const applied = await fetchAppliedMigrations(pool);
  const pending = selectPendingMigrations(available, applied);

  for (const file of pending) {
    const sql = await readFile(path.join(migrationsDir, file), 'utf8');
    await pool.query(sql);
    await pool.query('INSERT INTO schema_migrations (nome) VALUES (?)', [file]);
  }

  return pending;
}
