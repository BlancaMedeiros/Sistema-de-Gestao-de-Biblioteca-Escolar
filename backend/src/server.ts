import { app } from './app.js';
import { pool } from './config/database.js';
import { env } from './config/env.js';

const server = app.listen(env.port, '0.0.0.0', () => {
  console.info(`Backend em execução na porta ${env.port} (${env.nodeEnv}).`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.info(`Sinal ${signal} recebido. Encerrando o backend.`);

  server.close((serverError) => {
    void pool.end().finally(() => {
      process.exit(serverError ? 1 : 0);
    });
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
