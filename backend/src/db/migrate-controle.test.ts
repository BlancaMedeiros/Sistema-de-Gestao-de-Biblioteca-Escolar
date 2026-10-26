import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import type { Pool } from 'mysql2/promise';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';

import { runMigrations } from './migrate.js';

describe('controle de execução das migrations', () => {
  let diretorio: string;
  const primeira = '0001_primeira.sql';
  const segunda = '0002_segunda.sql';
  const sqlPrimeira = 'CREATE TABLE primeira (id INT);';
  const sqlSegunda = 'CREATE TABLE segunda (id INT);';

  beforeEach(async () => {
    diretorio = await mkdtemp(path.join(tmpdir(), 'migrations-controle-'));
    await writeFile(path.join(diretorio, segunda), sqlSegunda);
    await writeFile(path.join(diretorio, primeira), sqlPrimeira);
  });

  afterEach(async () => {
    await rm(diretorio, { recursive: true, force: true });
  });

  function criarPool(aplicadas: string[] = []) {
    const query = vi.fn(async (sql: string, _valores?: unknown[]) => {
      if (sql === 'SELECT nome FROM schema_migrations') {
        return [aplicadas.map((nome) => ({ nome })), []];
      }

      return [[], []];
    });

    return { query, pool: { query } as unknown as Pool };
  }

  test('executa em ordem e registra cada arquivo somente após seu DDL', async () => {
    const { pool, query } = criarPool();

    expect(await runMigrations(pool, diretorio)).toEqual([primeira, segunda]);
    expect(query.mock.calls.slice(2)).toEqual([
      [sqlPrimeira],
      ['INSERT INTO schema_migrations (nome) VALUES (?)', [primeira]],
      [sqlSegunda],
      ['INSERT INTO schema_migrations (nome) VALUES (?)', [segunda]],
    ]);
  });

  test('ignora arquivos já aplicados', async () => {
    const { pool, query } = criarPool([primeira]);

    expect(await runMigrations(pool, diretorio)).toEqual([segunda]);
    expect(query.mock.calls.slice(2)).toEqual([
      [sqlSegunda],
      ['INSERT INTO schema_migrations (nome) VALUES (?)', [segunda]],
    ]);
  });

  test('sem pendências não executa DDL de arquivos nem grava novos registros', async () => {
    const { pool, query } = criarPool([primeira, segunda]);

    expect(await runMigrations(pool, diretorio)).toEqual([]);
    expect(query).toHaveBeenCalledTimes(2);
  });

  test('falha no DDL impede o registro da migration e a execução da seguinte', async () => {
    const { pool, query } = criarPool();
    query.mockImplementation(async (sql) => {
      if (sql === sqlPrimeira) throw new Error('DDL inválido');
      return [[], []];
    });

    await expect(runMigrations(pool, diretorio)).rejects.toThrow('DDL inválido');
    expect(query.mock.calls.slice(2)).toEqual([[sqlPrimeira]]);
  });

  test('falha ao registrar o DDL aplicado interrompe antes da migration seguinte', async () => {
    const { pool, query } = criarPool();
    query.mockImplementation(async (sql) => {
      if (sql.startsWith('INSERT INTO schema_migrations')) {
        throw new Error('falha no histórico');
      }
      return [[], []];
    });

    await expect(runMigrations(pool, diretorio)).rejects.toThrow('falha no histórico');
    expect(query.mock.calls.slice(2)).toEqual([
      [sqlPrimeira],
      ['INSERT INTO schema_migrations (nome) VALUES (?)', [primeira]],
    ]);
  });

  test('falha ao consultar o histórico impede a execução de qualquer arquivo', async () => {
    const { pool, query } = criarPool();
    query.mockImplementation(async (sql) => {
      if (sql === 'SELECT nome FROM schema_migrations') {
        throw new Error('banco indisponível');
      }
      return [[], []];
    });

    await expect(runMigrations(pool, diretorio)).rejects.toThrow('banco indisponível');
    expect(query).toHaveBeenCalledTimes(2);
  });
});
