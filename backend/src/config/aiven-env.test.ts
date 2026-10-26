import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { carregarEnvAiven } from './aiven-env.js';

const VARIAVEIS = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SSL_CA', 'DB_CONNECTION_LIMIT', 'SESSION_SECRET'];

describe('carregarEnvAiven', () => {
  let diretorio: string;
  let original: Record<string, string | undefined>;

  beforeEach(async () => {
    original = Object.fromEntries(VARIAVEIS.map((nome) => [nome, process.env[nome]]));
    diretorio = await mkdtemp(path.join(tmpdir(), 'aiven-env-'));
    await writeFile(
      path.join(diretorio, '.env.aiven'),
      'AIVEN_HOST=db.exemplo.com\nAIVEN_PORT=1234\nAIVEN_APP_DATABASE=biblioteca\nAIVEN_APP_USER=app\nAIVEN_APP_PASSWORD=segredo\n',
    );
    await writeFile(path.join(diretorio, 'aiven-ca.pem'), '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n');
  });

  afterEach(async () => {
    for (const [nome, valor] of Object.entries(original)) {
      if (valor === undefined) delete process.env[nome];
      else process.env[nome] = valor;
    }
    await rm(diretorio, { recursive: true, force: true });
  });

  test('aponta as variáveis DB_* para o Aiven, com TLS', () => {
    const resultado = carregarEnvAiven(diretorio);

    expect(resultado).toEqual({ host: 'db.exemplo.com', banco: 'biblioteca' });
    expect(process.env.DB_HOST).toBe('db.exemplo.com');
    expect(process.env.DB_USER).toBe('app');
    expect(process.env.DB_SSL_CA).toContain('BEGIN CERTIFICATE');
  });

  test('deixa o ambiente pronto para carregar env.ts mesmo sem SESSION_SECRET (scripts não usam sessão)', () => {
    delete process.env.SESSION_SECRET;

    carregarEnvAiven(diretorio);

    expect(process.env.SESSION_SECRET).toBeTruthy();
  });

  test('não sobrescreve um SESSION_SECRET já definido', () => {
    process.env.SESSION_SECRET = 'valor-existente';

    carregarEnvAiven(diretorio);

    expect(process.env.SESSION_SECRET).toBe('valor-existente');
  });

  test('explica qual arquivo falta', async () => {
    await rm(path.join(diretorio, 'aiven-ca.pem'));

    expect(() => carregarEnvAiven(diretorio)).toThrow('aiven-ca.pem');
  });
});
