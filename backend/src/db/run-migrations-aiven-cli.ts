import { readFileSync } from 'node:fs';
import path from 'node:path';

import { parse } from 'dotenv';

import { repoRootDir } from '../config/local-env.js';

// Aplica as migrations no MySQL de produção (Aiven). Conexão em .env.aiven e
// certificado em aiven-ca.pem, ambos na raiz do repositório e fora do Git.
// Usa o usuário da aplicação, nunca o avnadmin.
const aiven = parse(readFileSync(path.join(repoRootDir, '.env.aiven')));
const obrigatorias = ['AIVEN_HOST', 'AIVEN_PORT', 'AIVEN_APP_DATABASE', 'AIVEN_APP_USER', 'AIVEN_APP_PASSWORD'];
const faltando = obrigatorias.filter((nome) => !aiven[nome]);

if (faltando.length > 0) {
  console.error(`✘ .env.aiven sem: ${faltando.join(', ')}`);
  process.exit(1);
}

process.env.DB_HOST = aiven.AIVEN_HOST;
process.env.DB_PORT = aiven.AIVEN_PORT;
process.env.DB_NAME = aiven.AIVEN_APP_DATABASE;
process.env.DB_USER = aiven.AIVEN_APP_USER;
process.env.DB_PASSWORD = aiven.AIVEN_APP_PASSWORD;
process.env.DB_SSL_CA = readFileSync(path.join(repoRootDir, 'aiven-ca.pem'), 'utf8');
process.env.DB_CONNECTION_LIMIT = '2';

console.info(`Aplicando migrations em ${aiven.AIVEN_HOST} (banco ${aiven.AIVEN_APP_DATABASE})...`);

await import('./run-migrations-cli.js');
