import express from 'express';
import swaggerUi from 'swagger-ui-express';

import { databaseIsReady } from './config/database.js';
import { sessionMiddleware } from './config/session.js';
import { swaggerSpec } from './config/swagger.js';
import { authRouter } from './modules/auth/auth.routes.js';

export const app = express();

app.disable('x-powered-by');
app.use(express.json());
app.use(sessionMiddleware);

function healthCheck(_request: express.Request, response: express.Response): void {
  response.status(200).json({
    status: 'ok',
    service: 'backend',
    timestamp: new Date().toISOString(),
  });
}

async function readinessCheck(_request: express.Request, response: express.Response): Promise<void> {
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
}

// As rotas sem prefixo atendem verificações diretas do Cloud Run. As rotas
// /api equivalentes são consumidas pelo Firebase Hosting, que preserva o path
// original ao encaminhar a requisição para o serviço.
app.get(['/health', '/api/health'], healthCheck);
app.get(['/ready', '/api/ready'], readinessCheck);

app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/api/docs.json', (_request, response) => {
  response.status(200).json(swaggerSpec);
});

app.use('/api/v1', authRouter);

app.use((_request, response) => {
  response.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Rota não encontrada.',
    },
  });
});
