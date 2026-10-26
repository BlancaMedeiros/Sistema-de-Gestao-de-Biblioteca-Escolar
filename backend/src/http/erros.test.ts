import request from 'supertest';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { app } from '../app.js';
import { pool } from '../config/database.js';
import { criarAgenteAutenticado } from '../test-utils/agente-autenticado.js';

afterEach(() => vi.restoreAllMocks());

describe('erros HTTP da aplicação', () => {
  test('JSON malformado retorna 400 estruturado sem reproduzir a entrada', async () => {
    const resposta = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"senha":"entrada-confidencial"');
    expect(resposta.status).toBe(400);
    expect(resposta.body.error.code).toBe('REQUISICAO_INVALIDA');
    expect(resposta.text).not.toContain('entrada-confidencial');
  });

  test('corpo acima de 100 KiB retorna 413 antes de executar autenticação', async () => {
    const resposta = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: 'x'.repeat(101 * 1024), senha: 'entrada-confidencial' });
    expect(resposta.status).toBe(413);
    expect(resposta.body.error.code).toBe('REQUISICAO_INVALIDA');
    expect(resposta.text).not.toContain('entrada-confidencial');
  });

  test.each([
    ['Content-Type', 'application/json; charset=iso-8859-1'],
    ['Content-Encoding', 'compress'],
  ])(
    'rejeita %s não suportado com 415, sem classificar como falha interna',
    async (header, valor) => {
      const resposta = await request(app)
        .post('/api/v1/auth/login')
        .set('Content-Type', 'application/json')
        .set(header, valor)
        .send('{}');
      expect(resposta.status).toBe(415);
      expect(resposta.body.error.code).toBe('REQUISICAO_INVALIDA');
    },
  );

  test('falha inesperada chega ao handler e retorna 500 sem SQL ou credenciais', async () => {
    const sessao = await criarAgenteAutenticado();
    try {
      const log = vi.spyOn(console, 'error').mockImplementation(() => undefined);
      const consulta = vi
        .spyOn(pool, 'query')
        .mockRejectedValueOnce(
          new Error('SELECT senha_hash FROM funcionarios; password=segredo-nao-expor'),
        );
      const resposta = await sessao.agente.get('/api/v1/livros');
      expect(resposta.status).toBe(500);
      expect(resposta.body).toEqual({
        error: { code: 'ERRO_INTERNO', message: 'Não foi possível concluir a operação.' },
      });
      expect(resposta.text).not.toMatch(/SELECT|senha_hash|segredo-nao-expor|stack/i);
      expect(log).toHaveBeenCalled();
      consulta.mockRestore();
      expect((await sessao.agente.get('/api/v1/livros')).status).toBe(200);
    } finally {
      vi.restoreAllMocks();
      await sessao.limpar();
    }
  });
});
