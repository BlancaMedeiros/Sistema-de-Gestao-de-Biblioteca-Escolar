import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarCenarioBiblioteca } from '../../test-utils/cenario-biblioteca.js';
import { hojeEscola, somarDias } from '../../utils/datas.js';

describe('empréstimos, renovações e devoluções persistentes', () => {
  let c: Awaited<ReturnType<typeof criarCenarioBiblioteca>>;
  beforeEach(async () => {
    c = await criarCenarioBiblioteca();
  });
  afterEach(async () => {
    await c?.limpar();
  });
  const url = (id: number) => `/api/v1/emprestimos/${id}`;
  async function preparar() {
    const livro = await c.livro();
    const usuario = await c.usuario();
    const resposta = await c.emprestar(livro.id, usuario.id);
    expect(resposta.status).toBe(201);
    return { livro, usuario, emprestimo: resposta.body.data };
  }
  test('chave de idempotência pertence ao funcionário e não conflita entre contas', async () => {
    const outro = await criarCenarioBiblioteca();
    try {
      const a = await c.livro();
      const u = await c.usuario();
      const b = await outro.livro();
      const v = await outro.usuario();
      const chave = randomUUID();
      expect((await c.emprestar(a.id, u.id, chave)).status).toBe(201);
      expect((await outro.emprestar(b.id, v.id, chave)).status).toBe(201);
    } finally {
      await outro.limpar();
    }
  });
  test('chaves estrangeiras impedem apagar fisicamente livros e leitores com histórico', async () => {
    const { livro, usuario, emprestimo } = await preparar();
    await c.acao(emprestimo.id, 'devolucao');
    await expect(pool.query('DELETE FROM livros WHERE id = ?', [livro.id])).rejects.toThrow();
    await expect(pool.query('DELETE FROM usuarios WHERE id = ?', [usuario.id])).rejects.toThrow();
    expect((await c.agente.get(url(emprestimo.id))).status).toBe(200);
    expect((await c.agente.delete(`/api/v1/livros/${livro.id}`)).status).toBe(204);
    expect(
      (await c.agente.patch(`/api/v1/usuarios/${usuario.id}`).send({ status: 'Inativo' })).status,
    ).toBe(200);
  });
  async function atrasar(id: number, vencimento = somarDias(hojeEscola(), -1)) {
    await pool.query(
      'UPDATE emprestimos SET data_emprestimo = ?, devolucao_prevista = ? WHERE id = ?',
      [somarDias(vencimento, -7), vencimento, id],
    );
  }

  test('todas as rotas exigem autenticação', async () => {
    for (const resposta of [
      await request(app).get('/api/v1/emprestimos'),
      await request(app).get('/api/v1/emprestimos/1'),
      await request(app).post('/api/v1/emprestimos').send({}),
      await request(app).post('/api/v1/emprestimos/1/renovacoes'),
      await request(app).post('/api/v1/emprestimos/1/devolucao'),
    ])
      expect(resposta.status).toBe(401);
  });
  test('servidor define datas e operador e desconta uma unidade disponível', async () => {
    const livro = await c.livro({ quantidadeTotal: 3, quantidadeManutencao: 1 });
    const usuario = await c.usuario();
    const criado = await c.emprestar(livro.id, usuario.id, randomUUID(), {
      dataEmprestimo: '2000-01-01',
      devolucaoPrevista: '2099-01-01',
      funcionarioId: 999,
      status: 'Devolvido',
    });
    expect(criado.status).toBe(201);
    expect(criado.body.data).toMatchObject({
      livroId: livro.id,
      usuarioId: usuario.id,
      funcionarioId: c.funcionario.id,
      dataEmprestimo: hojeEscola(),
      devolucaoPrevista: somarDias(hojeEscola(), 7),
      devolucaoReal: null,
      quantidadeRenovacoes: 0,
      status: 'Em Andamento',
    });
    expect((await c.agente.get(url(criado.body.data.id))).body).toEqual(criado.body);
    expect((await c.agente.get(`/api/v1/livros/${livro.id}`)).body.data.quantidadeDisponivel).toBe(
      1,
    );
  });
  test.each([undefined, '', 'com espaço', 'x'.repeat(101)])(
    'exige Idempotency-Key válida: %s',
    async (chave) => {
      const livro = await c.livro();
      const usuario = await c.usuario();
      const chamada = c.agente.post('/api/v1/emprestimos');
      if (chave !== undefined) chamada.set('Idempotency-Key', chave);
      const resposta = await chamada.send({ livroId: livro.id, usuarioId: usuario.id });
      expect(resposta.status).toBe(422);
      expect(resposta.body.error.fields['Idempotency-Key']).toBeDefined();
      expect(
        (await c.agente.get(`/api/v1/livros/${livro.id}`)).body.data.quantidadeDisponivel,
      ).toBe(5);
    },
  );
  test.each([
    { livroId: 0, usuarioId: 1 },
    { livroId: '1', usuarioId: 1 },
    { livroId: 1, usuarioId: -1 },
    {},
    { livroId: 1.5, usuarioId: 1 },
  ])('valida corpo %j', async (dados) => {
    const resposta = await c.agente
      .post('/api/v1/emprestimos')
      .set('Idempotency-Key', randomUUID())
      .send(dados);
    expect(resposta.status).toBe(422);
  });
  test('retorna 404 para referências inexistentes e IDs inválidos', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario();
    expect((await c.emprestar(livro.id, 4294967295)).body.error.code).toBe(
      'USUARIO_NAO_ENCONTRADO',
    );
    expect((await c.emprestar(4294967295, usuario.id)).body.error.code).toBe(
      'LIVRO_NAO_ENCONTRADO',
    );
    for (const id of ['abc', '0', '4294967295']) {
      expect((await c.agente.get(`/api/v1/emprestimos/${id}`)).status).toBe(404);
      expect(
        (
          await c.agente
            .post(`/api/v1/emprestimos/${id}/renovacoes`)
            .set('Idempotency-Key', randomUUID())
        ).status,
      ).toBe(404);
      expect(
        (
          await c.agente
            .post(`/api/v1/emprestimos/${id}/devolucao`)
            .set('Idempotency-Key', randomUUID())
        ).status,
      ).toBe(404);
    }
  });
  test('recusa leitor inativo, livro inativo e estoque todo em manutenção', async () => {
    const usuario = await c.usuario({ status: 'Inativo' });
    const livro = await c.livro();
    expect((await c.emprestar(livro.id, usuario.id)).body.error.code).toBe('USUARIO_INATIVO');
    await c.agente.patch(`/api/v1/usuarios/${usuario.id}`).send({ status: 'Ativo' });
    await c.agente.delete(`/api/v1/livros/${livro.id}`);
    expect((await c.emprestar(livro.id, usuario.id)).body.error.code).toBe('LIVRO_INATIVO');
    const manutencao = await c.livro({ quantidadeTotal: 1, quantidadeManutencao: 1 });
    expect((await c.emprestar(manutencao.id, usuario.id)).body.error.code).toBe(
      'LIVRO_INDISPONIVEL',
    );
  });
  test('limita a três abertos por leitor e volta a permitir após devolução', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario();
    const primeiro = await c.emprestar(livro.id, usuario.id);
    expect((await c.emprestar(livro.id, usuario.id)).status).toBe(201);
    expect((await c.emprestar(livro.id, usuario.id)).status).toBe(201);
    const quarto = await c.emprestar(livro.id, usuario.id);
    expect(quarto.status).toBe(409);
    expect(quarto.body.error.code).toBe('LIMITE_EMPRESTIMOS');
    await c.acao(primeiro.body.data.id, 'devolucao');
    expect((await c.emprestar(livro.id, usuario.id)).status).toBe(201);
  });
  test('atraso em qualquer empréstimo bloqueia novo empréstimo e renovação de outro em dia', async () => {
    const { livro, usuario, emprestimo } = await preparar();
    const outro = await c.emprestar(livro.id, usuario.id);
    await atrasar(emprestimo.id);
    expect((await c.agente.get(url(emprestimo.id))).body.data.status).toBe('Atrasado');
    expect((await c.emprestar(livro.id, usuario.id)).body.error.code).toBe('USUARIO_COM_ATRASOS');
    expect((await c.acao(outro.body.data.id, 'renovacoes')).body.error.code).toBe(
      'USUARIO_COM_ATRASOS',
    );
    expect((await c.acao(emprestimo.id, 'renovacoes')).status).toBe(409);
    expect((await c.acao(emprestimo.id, 'devolucao')).status).toBe(200);
    expect((await c.acao(outro.body.data.id, 'renovacoes')).status).toBe(200);
  });
  test('vencimento hoje pode ser renovado; prazo cresce sete dias sobre o anterior, no máximo duas vezes', async () => {
    const { emprestimo } = await preparar();
    await atrasar(emprestimo.id, hojeEscola());
    const primeira = await c.acao(emprestimo.id, 'renovacoes');
    expect(primeira.status).toBe(200);
    expect(primeira.body.data).toMatchObject({
      devolucaoPrevista: somarDias(hojeEscola(), 7),
      quantidadeRenovacoes: 1,
    });
    const segunda = await c.acao(emprestimo.id, 'renovacoes');
    expect(segunda.body.data).toMatchObject({
      devolucaoPrevista: somarDias(hojeEscola(), 14),
      quantidadeRenovacoes: 2,
    });
    expect((await c.acao(emprestimo.id, 'renovacoes')).body.error.code).toBe('LIMITE_RENOVACOES');
    const [historico] = await pool.query(
      "SELECT numero, funcionario_id, DATE_FORMAT(prazo_anterior, '%Y-%m-%d') AS anterior, DATE_FORMAT(novo_prazo, '%Y-%m-%d') AS novo FROM renovacoes WHERE emprestimo_id = ? ORDER BY numero",
      [emprestimo.id],
    );
    expect(historico).toEqual([
      {
        numero: 1,
        funcionario_id: c.funcionario.id,
        anterior: hojeEscola(),
        novo: somarDias(hojeEscola(), 7),
      },
      {
        numero: 2,
        funcionario_id: c.funcionario.id,
        anterior: somarDias(hojeEscola(), 7),
        novo: somarDias(hojeEscola(), 14),
      },
    ]);
  });
  test('devolve atrasado, registra operador/data e impede efeitos duplicados', async () => {
    const { livro, emprestimo } = await preparar();
    await atrasar(emprestimo.id);
    const chave = randomUUID();
    const devolvido = await c.acao(emprestimo.id, 'devolucao', chave);
    expect(devolvido.body.data).toMatchObject({
      status: 'Devolvido',
      devolucaoReal: hojeEscola(),
      devolvidoPor: c.funcionario.id,
    });
    expect((await c.acao(emprestimo.id, 'devolucao', chave)).body).toEqual(devolvido.body);
    expect((await c.acao(emprestimo.id, 'devolucao')).body.error.code).toBe('EMPRESTIMO_DEVOLVIDO');
    expect((await c.acao(emprestimo.id, 'renovacoes')).status).toBe(409);
    expect((await c.agente.get(`/api/v1/livros/${livro.id}`)).body.data.quantidadeDisponivel).toBe(
      5,
    );
  });
  test('idempotência de cadastro e renovação preserva o resultado e recusa outro corpo com mesma chave', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario();
    const outroUsuario = await c.usuario();
    const chave = randomUUID();
    const primeiro = await c.emprestar(livro.id, usuario.id, chave);
    const repetido = await c.emprestar(livro.id, usuario.id, chave);
    expect(repetido.status).toBe(201);
    expect(repetido.body).toEqual(primeiro.body);
    expect((await c.emprestar(livro.id, outroUsuario.id, chave)).body.error.code).toBe(
      'CHAVE_IDEMPOTENCIA_REUTILIZADA',
    );
    const renovarChave = randomUUID();
    const renovado = await c.acao(primeiro.body.data.id, 'renovacoes', renovarChave);
    expect((await c.acao(primeiro.body.data.id, 'renovacoes', renovarChave)).body).toEqual(
      renovado.body,
    );
    expect((await c.agente.get(url(primeiro.body.data.id))).body.data.quantidadeRenovacoes).toBe(1);
  });
  test('requisições concorrentes com mesma chave têm um único efeito', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario();
    const chave = randomUUID();
    const respostas = await Promise.all([
      c.emprestar(livro.id, usuario.id, chave),
      c.emprestar(livro.id, usuario.id, chave),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([201, 201]);
    expect(respostas[0].body).toEqual(respostas[1].body);
    const id = respostas[0].body.data.id;
    const renovacao = randomUUID();
    const renovadas = await Promise.all([
      c.acao(id, 'renovacoes', renovacao),
      c.acao(id, 'renovacoes', renovacao),
    ]);
    expect(renovadas[0].body).toEqual(renovadas[1].body);
    expect(renovadas[0].body.data.quantidadeRenovacoes).toBe(1);
    const devolucao = randomUUID();
    const devolvidas = await Promise.all([
      c.acao(id, 'devolucao', devolucao),
      c.acao(id, 'devolucao', devolucao),
    ]);
    expect(devolvidas.map((r) => r.status)).toEqual([200, 200]);
    expect(devolvidas[0].body).toEqual(devolvidas[1].body);
  });
  test('chaves diferenciam maiúsculas e minúsculas e falha não reserva uma intenção', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario({ status: 'Inativo' });
    const chave = `Case-${randomUUID()}`;
    expect((await c.emprestar(livro.id, usuario.id, chave)).status).toBe(409);
    await c.agente.patch(`/api/v1/usuarios/${usuario.id}`).send({ status: 'Ativo' });
    const primeiro = await c.emprestar(livro.id, usuario.id, chave);
    const segundo = await c.emprestar(livro.id, usuario.id, chave.toLowerCase());
    expect(primeiro.status).toBe(201);
    expect(segundo.status).toBe(201);
    expect(primeiro.body.data.id).not.toBe(segundo.body.data.id);
  });
  test('disputa pelo último exemplar aceita apenas um empréstimo e mostra Esgotado', async () => {
    const livro = await c.livro({ quantidadeTotal: 2, quantidadeManutencao: 1 });
    const a = await c.usuario();
    const b = await c.usuario();
    const respostas = await Promise.all([c.emprestar(livro.id, a.id), c.emprestar(livro.id, b.id)]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(respostas.find((r) => r.status === 409)?.body.error.code).toBe('LIVRO_INDISPONIVEL');
    const consulta = await c.agente.get(`/api/v1/livros/${livro.id}`);
    expect(consulta.body.data).toMatchObject({ quantidadeDisponivel: 0, status: 'Esgotado' });
  });
  test('disputa pelo terceiro empréstimo em livros diferentes respeita o limite do leitor', async () => {
    const a = await c.livro();
    const b = await c.livro();
    const usuario = await c.usuario();
    await c.emprestar(a.id, usuario.id);
    await c.emprestar(a.id, usuario.id);
    const respostas = await Promise.all([
      c.emprestar(a.id, usuario.id),
      c.emprestar(b.id, usuario.id),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([201, 409]);
    expect(respostas.find((r) => r.status === 409)?.body.error.code).toBe('LIMITE_EMPRESTIMOS');
  });
  test('renovações concorrentes com intenções diferentes não ultrapassam duas', async () => {
    const { emprestimo } = await preparar();
    await c.acao(emprestimo.id, 'renovacoes');
    const respostas = await Promise.all([
      c.acao(emprestimo.id, 'renovacoes'),
      c.acao(emprestimo.id, 'renovacoes'),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await c.agente.get(url(emprestimo.id))).body.data.quantidadeRenovacoes).toBe(2);
  });
  test('devoluções concorrentes com intenções diferentes liberam uma única unidade', async () => {
    const { livro, emprestimo } = await preparar();
    const respostas = await Promise.all([
      c.acao(emprestimo.id, 'devolucao'),
      c.acao(emprestimo.id, 'devolucao'),
    ]);
    expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
    expect((await c.agente.get(`/api/v1/livros/${livro.id}`)).body.data.quantidadeDisponivel).toBe(
      5,
    );
  });
  test('livro emprestado não pode ser inativado nem ter estoque abaixo da soma comprometida', async () => {
    const { livro, emprestimo } = await preparar();
    const livroUrl = `/api/v1/livros/${livro.id}`;
    expect((await c.agente.delete(livroUrl)).body.error.code).toBe('LIVRO_COM_EMPRESTIMOS');
    expect((await c.agente.patch(livroUrl).send({ quantidadeManutencao: 5 })).status).toBe(422);
    expect(
      (await c.agente.patch(livroUrl).send({ quantidadeTotal: 1, quantidadeManutencao: 1 })).status,
    ).toBe(422);
    expect(
      (await c.agente.patch(livroUrl).send({ quantidadeTotal: 1, quantidadeManutencao: 0 })).body
        .data,
    ).toMatchObject({ quantidadeDisponivel: 0, status: 'Esgotado' });
    await c.acao(emprestimo.id, 'devolucao');
    expect((await c.agente.delete(livroUrl)).status).toBe(204);
    expect((await c.agente.get(url(emprestimo.id))).body.data.status).toBe('Devolvido');
  });
  test('inativação de leitor concorrente com empréstimo preserva a regra', async () => {
    const livro = await c.livro();
    const usuario = await c.usuario();
    const [inativacao, emprestimo] = await Promise.all([
      c.agente.patch(`/api/v1/usuarios/${usuario.id}`).send({ status: 'Inativo' }),
      c.emprestar(livro.id, usuario.id),
    ]);
    expect([
      [200, 409],
      [409, 201],
    ]).toContainEqual([inativacao.status, emprestimo.status]);
  });
  test('inativação do livro concorrente com empréstimo não cria inconsistência', async () => {
    const livro = await c.livro({ quantidadeTotal: 1 });
    const usuario = await c.usuario();
    const [inativacao, emprestimo] = await Promise.all([
      c.agente.delete(`/api/v1/livros/${livro.id}`),
      c.emprestar(livro.id, usuario.id),
    ]);
    expect([
      [204, 409],
      [409, 201],
    ]).toContainEqual([inativacao.status, emprestimo.status]);
    if (emprestimo.status === 201) {
      expect(
        (await c.agente.get(`/api/v1/livros/${livro.id}`)).body.data.quantidadeDisponivel,
      ).toBe(0);
    }
  });
  test('histórico, listagem e filtros usam datas ISO e mantêm o leitor do caminho', async () => {
    const { livro, usuario, emprestimo } = await preparar();
    const outroUsuario = await c.usuario();
    const outro = await c.emprestar(livro.id, outroUsuario.id);
    const segundo = await c.emprestar(livro.id, usuario.id);
    await atrasar(emprestimo.id);
    const historico = await c.agente
      .get(`/api/v1/usuarios/${usuario.id}/emprestimos`)
      .query({ pageSize: 1, usuarioId: outroUsuario.id });
    expect(historico.body.pagination.total).toBe(2);
    expect(historico.body.data[0].id).toBe(segundo.body.data.id);
    expect(historico.body.resumo).toEqual({
      totalEmprestimos: 2,
      emprestimosAtivos: 2,
      atrasados: 1,
    });
    const atrasados = await c.agente
      .get('/api/v1/emprestimos')
      .query({ usuarioId: usuario.id, livroId: livro.id, status: 'Atrasado', busca: c.prefixo });
    expect(atrasados.body.data.map((e: { id: number }) => e.id)).toEqual([emprestimo.id]);
    expect(atrasados.body.data[0].devolucaoPrevista).toBe(somarDias(hojeEscola(), -1));
    await c.acao(outro.body.data.id, 'devolucao');
    expect(
      (
        await c.agente
          .get('/api/v1/emprestimos')
          .query({ usuarioId: outroUsuario.id, status: 'Devolvido' })
      ).body.pagination.total,
    ).toBe(1);
  });
  test.each([
    { page: 0 },
    { pageSize: 101 },
    { status: 'Outro' },
    { usuarioId: 'abc' },
    { vencimentoDe: '2026-02-30' },
    { vencimentoDe: '2026-10-20', vencimentoAte: '2026-10-10' },
    { busca: 'x'.repeat(101) },
  ])('valida filtros %j', async (filtro) => {
    expect((await c.agente.get('/api/v1/emprestimos').query(filtro)).status).toBe(422);
  });
  test('ações não aceitam comandos/datas do cliente e JSON malformado vira erro estruturado', async () => {
    const { emprestimo } = await preparar();
    expect(
      (
        await c.agente
          .post(`${url(emprestimo.id)}/renovacoes`)
          .set('Idempotency-Key', randomUUID())
          .send({ dias: 100 })
      ).status,
    ).toBe(422);
    const invalido = await c.agente
      .post('/api/v1/emprestimos')
      .set('Content-Type', 'application/json')
      .send('{');
    expect(invalido.status).toBe(400);
    expect(invalido.body.error.code).toBe('REQUISICAO_INVALIDA');
  });
});
