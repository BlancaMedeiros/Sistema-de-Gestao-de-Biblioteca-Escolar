import { carregarEnvAiven } from '../config/aiven-env.js';

// Aplica as migrations no MySQL de produção (Aiven), com o usuário da
// aplicação — nunca o avnadmin.
try {
  const { host, banco } = carregarEnvAiven();
  console.info(`Aplicando migrations em ${host} (banco ${banco})...`);
} catch (error) {
  console.error(`✘ ${(error as Error).message}`);
  process.exit(1);
}

await import('./run-migrations-cli.js');
