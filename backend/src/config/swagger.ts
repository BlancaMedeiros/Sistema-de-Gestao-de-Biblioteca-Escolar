import path from 'node:path';
import { fileURLToPath } from 'node:url';

import swaggerJSDoc from 'swagger-jsdoc';

const configDir = path.dirname(fileURLToPath(import.meta.url));

// A base do OpenAPI é /api/v1, mesmo prefixo com que as rotas de negócio
// são montadas no Express — cada arquivo *.routes.ts documenta seus
// caminhos relativos a essa base em um bloco JSDoc @openapi acima do
// handler. O contrato cresce endpoint a endpoint, sem precisar manter um
// YAML separado.
const definition = {
  openapi: '3.0.3',
  info: {
    title: 'API do Sistema de Gestão de Biblioteca Escolar',
    version: '0.1.0',
    description:
      'Contrato incremental, gerado a partir dos comentários JSDoc de cada rota implementada. ' +
      'Ainda não cobre todo o mapa proposto em docs/mapa-inicial-de-endpoints.md — só o que já existe em código.',
  },
  servers: [{ url: '/api/v1', description: 'Prefixo de todas as rotas de negócio' }],
  components: {
    schemas: {
      FuncionarioPerfil: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          nome: { type: 'string', example: 'Ana Bibliotecária' },
          login: { type: 'string', example: 'ana.bibliotecaria' },
        },
      },
      Erro: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            properties: {
              code: { type: 'string', example: 'CREDENCIAIS_INVALIDAS' },
              message: { type: 'string', example: 'Login ou senha incorretos.' },
            },
          },
        },
      },
    },
  },
};

export const swaggerSpec = swaggerJSDoc({
  definition,
  apis: [
    path.join(configDir, '..', 'modules/**/*.routes.ts'),
    path.join(configDir, '..', 'modules/**/*.routes.js'),
  ],
});
