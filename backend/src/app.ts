import express from 'express';

import { databaseIsReady } from './config/database.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());

app.get('/health', (_request, response) => {
  response.status(200).json({
    status: 'ok',
    service: 'backend',
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (_request, response) => {
  try {
    const ready = await databaseIsReady();

    if (!ready) {
      response.status(503).json({
        error: {
          code: 'DATABASE_UNAVAILABLE',
          message: 'O banco de dados não está pronto para receber requisições.',
        },
      });
      return;
    }

    response.status(200).json({
      status: 'ok',
      service: 'backend',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Falha na verificação de disponibilidade do banco de dados.', error);
    response.status(503).json({
      error: {
        code: 'DATABASE_UNAVAILABLE',
        message: 'O banco de dados não está pronto para receber requisições.',
      },
    });
  }
});

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Rota não encontrada.',
    },
  });
});
