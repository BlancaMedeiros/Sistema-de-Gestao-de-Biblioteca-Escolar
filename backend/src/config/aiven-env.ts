import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'dotenv';

import { repoRootDir } from './local-env.js';

const OBRIGATORIAS = ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_APP_DATABASE', 'AIVEN_APP_USER', 'AIVEN_APP_PASSWORD'];

/**
 * Aponta o processo para o MySQL de produção (Aiven), com o usuário da
 * aplicação e TLS. Lê `.env.aiven` e `aiven-ca.pem` da raiz do repositório
 * (ambos fora do Git). Precisa rodar antes de importar `config/database.js`.
 */
export function carregarEnvAiven(diretorio: string = repoRootDir): { host: string; banco: string } {
  const arquivoEnv = path.join(diretorio, '.env.aiven');
  const arquivoCa = path.join(diretorio, 'aiven-ca.pem');

  for (const arquivo of [arquivoEnv, arquivoCa]) {
    if (!existsSync(arquivo)) {
      throw new Error(`Arquivo não encontrado: ${arquivo} — ver docs/deploy-firebase-cloud-run.md.`);
    }
  }

  const aiven = parse(readFileSync(arquivoEnv));
  const faltando = OBRIGATORIAS.filter((nome) => !aiven[nome]);

  if (faltando.length > 0) {
    throw new Error(`.env.aiven sem: ${faltando.join(', ')}`);
  }

  process.env.DB_HOST = aiven.AIVEN_HOST;
  process.env.DB_PORT = aiven.AIVEN_PORT;
  process.env.DB_NAME = aiven.AIVEN_APP_DATABASE;
  process.env.DB_USER = aiven.AIVEN_APP_USER;
  process.env.DB_PASSWORD = aiven.AIVEN_APP_PASSWORD;
  process.env.DB_SSL_CA = readFileSync(arquivoCa, 'utf8');
  process.env.DB_CONNECTION_LIMIT = '2';
  // env.ts exige SESSION_SECRET ao ser importado, mas scripts de banco não
  // criam sessões; sem isso o import de config/database.js quebra.
  process.env.SESSION_SECRET ??= 'nao-usado-por-scripts-de-banco';

  return { host: aiven.AIVEN_HOST, banco: aiven.AIVEN_APP_DATABASE };
}
