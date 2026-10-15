import { afterEach, describe, expect, test, vi } from 'vitest';

const dependencias = vi.hoisted(() => ({
  end: vi.fn(),
  runMigrations: vi.fn(),
}));

vi.mock('../config/local-env.js', () => ({
  loadLocalEnv: vi.fn(),
  migrationsDir: '/database/migrations',
}));
vi.mock('../config/database.js', () => ({ pool: { end: dependencias.end } }));
vi.mock('./migrate.js', () => ({ runMigrations: dependencias.runMigrations }));

describe('código de saída do CLI de migrations usado pelo deploy', () => {
  const codigoOriginal = process.exitCode;

  afterEach(() => {
    process.exitCode = codigoOriginal;
    vi.restoreAllMocks();
    vi.resetAllMocks();
    vi.resetModules();
  });

  test('sucesso sem pendências retorna zero e encerra o pool', async () => {
    dependencias.runMigrations.mockResolvedValue([]);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});

    await import('./run-migrations-cli.js');

    expect(process.exitCode).toBe(0);
    expect(log).toHaveBeenCalledWith('Nenhuma migration pendente.');
    expect(dependencias.end).toHaveBeenCalledOnce();
  });

  test('falha retorna um e encerra o pool para bloquear os passos de publicação', async () => {
    dependencias.runMigrations.mockRejectedValue(new Error('falha simulada'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await import('./run-migrations-cli.js');

    expect(process.exitCode).toBe(1);
    expect(dependencias.end).toHaveBeenCalledOnce();
  });
});
