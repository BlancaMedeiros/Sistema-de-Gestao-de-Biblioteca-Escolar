import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';

const configDir = path.dirname(fileURLToPath(import.meta.url));
export const backendDir = path.join(configDir, '..', '..');
export const repoRootDir = path.join(backendDir, '..');
export const migrationsDir = path.join(repoRootDir, 'database', 'migrations');

/**
 * Carrega o .env da raiz do monorepo e mapeia as variáveis do MySQL do
 * Docker Compose (MYSQL_*) para as que o backend espera (DB_*), apontando
 * para a porta publicada no host em vez do hostname interno "mysql".
 *
 * Serve só para rodar scripts fora do container (testes, migrations, seed);
 * dentro do Docker Compose essas variáveis já chegam prontas pelo
 * compose.yaml e esta função não é chamada.
 */
export function loadLocalEnv(): void {
  loadEnv({ path: path.join(repoRootDir, '.env') });

  process.env.DB_HOST ??= '127.0.0.1';
  process.env.DB_PORT ??= process.env.MYSQL_PORT ?? '3306';
  process.env.DB_NAME ??= process.env.MYSQL_DATABASE;
  process.env.DB_USER ??= process.env.MYSQL_USER;
  process.env.DB_PASSWORD ??= process.env.MYSQL_PASSWORD;
  process.env.SESSION_SECRET ??= 'segredo-de-teste-nao-usar-em-producao';
}
