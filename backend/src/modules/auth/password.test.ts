import { describe, expect, test } from 'vitest';

import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  test('um hash aceita a senha original', async () => {
    const hash = await hashPassword('senha-correta-123');

    await expect(verifyPassword(hash, 'senha-correta-123')).resolves.toBe(true);
  });

  test('um hash rejeita uma senha incorreta', async () => {
    const hash = await hashPassword('senha-correta-123');

    await expect(verifyPassword(hash, 'senha-errada')).resolves.toBe(false);
  });

  test('duas chamadas para a mesma senha produzem hashes diferentes', async () => {
    const primeiroHash = await hashPassword('mesma-senha');
    const segundoHash = await hashPassword('mesma-senha');

    expect(primeiroHash).not.toBe(segundoHash);
  });
});
