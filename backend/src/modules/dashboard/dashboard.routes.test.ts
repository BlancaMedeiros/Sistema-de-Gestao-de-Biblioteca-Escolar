import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarCenarioBiblioteca } from '../../test-utils/cenario-biblioteca.js';
import { hojeEscola, somarDias } from '../../utils/datas.js';

describe('dashboard e relatório persistentes', () => {
  let c: Awaited<ReturnType<typeof criarCenarioBiblioteca>>;
  beforeEach(async () => {
    c = await criarCenarioBiblioteca();
  });
  afterEach(async () => {
    await c?.limpar();
  });
  test('ambos exigem sessão', async () => {
    expect((await request(app).get('/api/v1/dashboard')).status).toBe(401);
    expect((await request(app).get('/api/v1/relatorios/pendencias')).status).toBe(401);
  });
  test('métricas conciliam unidades, abertos/atrasados, devoluções do dia e leitores ativos', async () => {
    const base = (await c.agente.get('/api/v1/dashboard')).body.data.metricas;
    const a = await c.livro({ quantidadeTotal: 5, quantidadeManutencao: 1 });
    const b = await c.livro({ quantidadeTotal: 3 });
    const inativo = await c.livro({ quantidadeTotal: 10 });
    await c.agente.delete(`/api/v1/livros/${inativo.id}`);
    const u = await c.usuario();
    const v = await c.usuario();
    await c.usuario({ status: 'Inativo' });
    const atrasado = (await c.emprestar(a.id, u.id)).body.data;
    const hoje = (await c.emprestar(b.id, v.id)).body.data;
    const devolvido = (await c.emprestar(a.id, u.id)).body.data;
    await c.acao(devolvido.id, 'devolucao');
    await pool.query(
      'UPDATE emprestimos SET data_emprestimo = ?, devolucao_prevista = ? WHERE id = ?',
      [somarDias(hojeEscola(), -8), somarDias(hojeEscola(), -1), atrasado.id],
    );
    await pool.query('UPDATE emprestimos SET devolucao_prevista = ? WHERE id = ?', [
      hojeEscola(),
      hoje.id,
    ]);
    const resultado = await c.agente.get('/api/v1/dashboard');
    expect(resultado.status).toBe(200);
    expect(resultado.body.data.dataReferencia).toBe(hojeEscola());
    expect(resultado.body.data.metricas).toEqual({
      totalAcervo: base.totalAcervo + 8,
      usuariosAtivos: base.usuariosAtivos + 2,
      emprestimosAtivos: base.emprestimosAtivos + 2,
      devolucoesPendentes: base.devolucoesPendentes + 1,
      devolucoesHoje: base.devolucoesHoje + 1,
    });
    expect(
      resultado.body.data.ultimosEmprestimos.slice(0, 3).map((e: { id: number }) => e.id),
    ).toEqual([devolvido.id, hoje.id, atrasado.id]);
    expect(resultado.body.data.ultimosEmprestimos.length).toBeLessThanOrEqual(4);
    expect(resultado.body.data.devolucoesHoje.map((e: { id: number }) => e.id)).toContain(hoje.id);
    expect(resultado.body.data.devolucoesHoje.map((e: { id: number }) => e.id)).not.toContain(
      devolvido.id,
    );
    const lista = await c.agente.get('/api/v1/relatorios/pendencias').query({ busca: c.prefixo });
    expect(lista.body.pagination.total).toBe(2);
    const filtro = await c.agente
      .get('/api/v1/relatorios/pendencias')
      .query({ busca: c.prefixo, status: 'Atrasado', usuarioId: u.id });
    expect(filtro.body.data.map((e: { id: number }) => e.id)).toEqual([atrasado.id]);
    const doDia = await c.agente.get('/api/v1/relatorios/pendencias').query({
      busca: c.prefixo,
      vencimentoDe: hojeEscola(),
      vencimentoAte: hojeEscola(),
      pageSize: 1,
    });
    expect(doDia.body.data[0].id).toBe(hoje.id);
  });
  test('relatório não aceita devolvidos nem intervalos/dimensões inválidos', async () => {
    for (const filtro of [
      { status: 'Devolvido' },
      { vencimentoDe: '2026-02-30' },
      { pageSize: 101 },
      { vencimentoDe: '2026-10-20', vencimentoAte: '2026-10-10' },
    ])
      expect((await c.agente.get('/api/v1/relatorios/pendencias').query(filtro)).status).toBe(422);
  });
  test('Swagger contém todas as operações restantes e referências resolvíveis', async () => {
    const contrato = (await request(app).get('/api/docs.json')).body;
    const operacoes = {
      '/auth/logout': ['post'],
      '/me': ['get', 'patch'],
      '/me/senha': ['put'],
      '/funcionarios': ['post'],
      '/usuarios': ['get', 'post'],
      '/usuarios/{id}': ['get', 'patch'],
      '/usuarios/{id}/emprestimos': ['get'],
      '/emprestimos': ['get', 'post'],
      '/emprestimos/{id}': ['get'],
      '/emprestimos/{id}/renovacoes': ['post'],
      '/emprestimos/{id}/devolucao': ['post'],
      '/dashboard': ['get'],
      '/relatorios/pendencias': ['get'],
    };
    for (const [caminho, metodos] of Object.entries(operacoes))
      for (const metodo of metodos)
        expect(contrato.paths[caminho][metodo].security).toEqual([{ sessao: [] }]);
    for (const referencia of JSON.stringify(contrato).matchAll(/"\$ref":"#\/([^" ]+)"/g))
      expect(
        referencia[1].split('/').reduce((objeto, chave) => objeto?.[chave], contrato),
        referencia[1],
      ).toBeDefined();
    expect(contrato.components.schemas.FuncionarioPerfil.required).toEqual(
      expect.arrayContaining([
        'email',
        'telefone',
        'usuarioId',
        'matricula',
        'cargo',
        'emprestimosAtivos',
        'historicoTotal',
      ]),
    );
    expect(contrato.components.schemas.PerfilEdicao.properties.usuarioId.nullable).toBe(true);
    expect(contrato.components.schemas.Emprestimo.properties.livroLocalizacao.readOnly).toBe(true);
  });
});
