import { describe, expect, test } from 'vitest';

import { buildPoolOptions } from './database.js';

const base = {
  host: 'db.exemplo.com',
  port: 3306,
  socketPath: undefined,
  name: 'biblioteca',
  user: 'app',
  password: 'segredo',
  sslCa: undefined,
  connectionLimit: 10,
};

describe('buildPoolOptions', () => {
  test('com certificado CA, exige TLS e verifica o certificado do servidor', () => {
    const options = buildPoolOptions({ ...base, sslCa: 'CERTIFICADO' });

    expect(options.ssl).toEqual({ ca: 'CERTIFICADO', rejectUnauthorized: true });
  });

  test('sem certificado CA, não configura TLS', () => {
    const options = buildPoolOptions(base);

    expect(options.ssl).toBeUndefined();
  });

  test('usa o limite de conexões configurado', () => {
    const options = buildPoolOptions({ ...base, connectionLimit: 5 });

    expect(options.connectionLimit).toBe(5);
  });

  test('com socketPath, conecta pelo socket em vez de host e porta', () => {
    const options = buildPoolOptions({ ...base, socketPath: '/cloudsql/x' });

    expect(options.socketPath).toBe('/cloudsql/x');
    expect(options.host).toBeUndefined();
  });
});
