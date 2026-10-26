import { afterEach, describe, expect, test, vi } from 'vitest';

async function carregarEnv() {
  const modulo = await import('./env.js');

  return modulo.env;
}

describe('env.database', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  test('lê DB_SSL_CA como o conteúdo do certificado', async () => {
    vi.stubEnv('DB_SSL_CA', '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----');

    const env = await carregarEnv();

    expect(env.database.sslCa).toContain('BEGIN CERTIFICATE');
  });

  test('sem DB_SSL_CA, sslCa fica indefinido', async () => {
    vi.stubEnv('DB_SSL_CA', '');

    const env = await carregarEnv();

    expect(env.database.sslCa).toBeUndefined();
  });

  test('DB_CONNECTION_LIMIT padrão é 10', async () => {
    vi.stubEnv('DB_CONNECTION_LIMIT', '');

    const env = await carregarEnv();

    expect(env.database.connectionLimit).toBe(10);
  });

  test('DB_CONNECTION_LIMIT aceita um inteiro positivo', async () => {
    vi.stubEnv('DB_CONNECTION_LIMIT', '5');

    const env = await carregarEnv();

    expect(env.database.connectionLimit).toBe(5);
  });

  test('DB_CONNECTION_LIMIT inválido interrompe a inicialização', async () => {
    vi.stubEnv('DB_CONNECTION_LIMIT', '0');

    await expect(carregarEnv()).rejects.toThrow('DB_CONNECTION_LIMIT');
  });
});
