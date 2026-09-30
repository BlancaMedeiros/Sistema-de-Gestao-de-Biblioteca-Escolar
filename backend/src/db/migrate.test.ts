import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { pool } from '../config/database.js';
import { runMigrations } from './migrate.js';

describe('runMigrations', () => {
  let migrationsDir: string;
  const tabelaTeste = '_teste_migrate_amostra';

  beforeEach(async () => {
    migrationsDir = await mkdtemp(path.join(tmpdir(), 'migrations-'));
    await writeFile(
      path.join(migrationsDir, '0001_criar_tabela_teste.sql'),
      `CREATE TABLE ${tabelaTeste} (id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY) ENGINE=InnoDB;`,
    );
  });

  afterEach(async () => {
    await pool.query(`DROP TABLE IF EXISTS ${tabelaTeste}`);
    await pool.query('DELETE FROM schema_migrations WHERE nome = ?', ['0001_criar_tabela_teste.sql']);
    await rm(migrationsDir, { recursive: true, force: true });
  });

  test('aplica migrations pendentes e registra o nome em schema_migrations', async () => {
    const aplicadas = await runMigrations(pool, migrationsDir);

    expect(aplicadas).toEqual(['0001_criar_tabela_teste.sql']);

    const [rows] = await pool.query('SELECT nome FROM schema_migrations WHERE nome = ?', [
      '0001_criar_tabela_teste.sql',
    ]);
    expect((rows as Array<{ nome: string }>)).toHaveLength(1);
  });

  test('não reaplica uma migration já registrada', async () => {
    await runMigrations(pool, migrationsDir);

    const segundaExecucao = await runMigrations(pool, migrationsDir);

    expect(segundaExecucao).toEqual([]);
  });
});
