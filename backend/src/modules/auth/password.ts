import * as argon2 from 'argon2';

export const SENHA_MINIMA = 8;

export async function hashPassword(senha: string): Promise<string> {
  return argon2.hash(senha, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, senha: string): Promise<boolean> {
  return argon2.verify(hash, senha);
}
