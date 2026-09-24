import { loadLocalEnv, migrationsDir } from '../config/local-env.js';

// process.env precisa estar pronto antes de importar config/database.js
// (ele lê as variáveis no carregamento do módulo), por isso os imports
// abaixo são dinâmicos e vêm depois de loadLocalEnv().
loadLocalEnv();

const { pool } = await import('../config/database.js');
const { runMigrations } = await import('./migrate.js');

try {
  const aplicadas = await runMigrations(pool, migrationsDir);

  if (aplicadas.length === 0) {
    console.info('Nenhuma migration pendente.');
  } else {
    console.info(`Migrations aplicadas: ${aplicadas.join(', ')}`);
  }

  process.exitCode = 0;
} catch (error) {
  console.error('Falha ao aplicar migrations.', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
