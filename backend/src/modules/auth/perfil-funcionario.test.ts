import request from 'supertest';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { app } from '../../app.js';
import { pool } from '../../config/database.js';
import { criarCenarioBiblioteca } from '../../test-utils/cenario-biblioteca.js';
import { hojeEscola, somarDias } from '../../utils/datas.js';

describe('Meu Perfil compatível com o frontend', () => {
  let c: Awaited<ReturnType<typeof criarCenarioBiblioteca>>;
  const adicionais: number[] = [];
  beforeEach(async () => {
    c = await criarCenarioBiblioteca();
  });
  afterEach(async () => {
    for (const id of adicionais.splice(0)) {
      await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [
        id,
      ]);
      await pool.query('DELETE FROM funcionarios WHERE id = ?', [id]);
    }
    await c?.limpar();
  });

  test('perfil sem vínculo tem todos os campos, sem inventar matrícula ou leituras', async () => {
    const leitor = await c.usuario();
    const livro = await c.livro();
    await c.emprestar(livro.id, leitor.id);
    const resposta = await c.agente.get('/api/v1/me');
    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toEqual({
      id: c.funcionario.id,
      nome: c.funcionario.nome,
      login: c.funcionario.login,
      email: null,
      telefone: null,
      usuarioId: null,
      matricula: null,
      cargo: 'Funcionário autorizado',
      emprestimosAtivos: 0,
      historicoTotal: 0,
    });
  });

  test('contatos são editáveis sem nome e persistem sem alterar o leitor', async () => {
    const leitor = await c.usuario({ email: 'leitor@example.test' });
    const resposta = await c.agente.patch('/api/v1/me').send({
      email: '  conta@example.test  ',
      telefone: '  (11) 90000-0000  ',
      usuarioId: leitor.id,
    });
    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toMatchObject({
      nome: c.funcionario.nome,
      email: 'conta@example.test',
      telefone: '(11) 90000-0000',
      usuarioId: leitor.id,
      matricula: leitor.matricula,
    });
    expect((await c.agente.get('/api/v1/me')).body).toEqual(resposta.body);
    expect((await c.agente.get(`/api/v1/usuarios/${leitor.id}`)).body.data.email).toBe(
      'leitor@example.test',
    );
    const limpo = await c.agente.patch('/api/v1/me').send({ email: '', telefone: null });
    expect(limpo.body.data).toMatchObject({ email: null, telefone: null, usuarioId: leitor.id });
  });

  test.each([
    { email: 'invalido' },
    { telefone: 'x'.repeat(31) },
    { nome: 'x'.repeat(121) },
    { usuarioId: 0 },
    { usuarioId: '1' },
    {},
    { cargo: 'ADMIN' },
    { matricula: 'forjada' },
    { historicoTotal: 999 },
    { novaSenha: 'AtalhoProibido123' },
  ])('entrada inválida ou somente leitura não modifica o perfil: %j', async (dados) => {
    const antes = (await c.agente.get('/api/v1/me')).body;
    const resposta = await c.agente.patch('/api/v1/me').send(dados);
    expect(resposta.status).toBe(422);
    expect((await c.agente.get('/api/v1/me')).body).toEqual(antes);
  });

  test('campos de identidade/permissão/contadores não podem ser forjados', async () => {
    const resposta = await c.agente.patch('/api/v1/me').send({
      telefone: '123',
      id: 1,
      login: 'outra-conta',
      cargo: 'ADMIN',
      matricula: 'falsa',
      emprestimosAtivos: 500,
      historicoTotal: 1000,
      ativo: 0,
    });
    expect(resposta.status).toBe(200);
    expect(resposta.body.data).toMatchObject({
      id: c.funcionario.id,
      login: c.funcionario.login,
      telefone: '123',
      cargo: 'Funcionário autorizado',
      matricula: null,
      emprestimosAtivos: 0,
      historicoTotal: 0,
    });
  });

  test('vínculo inexistente recusa também o contato da mesma operação', async () => {
    const resposta = await c.agente
      .patch('/api/v1/me')
      .send({ usuarioId: 4294967295, email: 'nao-salvar@example.test' });
    expect(resposta.status).toBe(404);
    expect(resposta.body.error.code).toBe('USUARIO_NAO_ENCONTRADO');
    expect((await c.agente.get('/api/v1/me')).body.data.email).toBeNull();
  });

  test('estatísticas são do leitor explicitamente vinculado e incluem atrasos', async () => {
    const livro = await c.livro();
    const leitor = await c.usuario();
    const outro = await c.usuario();
    const a = (await c.emprestar(livro.id, leitor.id)).body.data;
    const b = (await c.emprestar(livro.id, leitor.id)).body.data;
    await c.emprestar(livro.id, leitor.id);
    await c.emprestar(livro.id, outro.id);
    await c.acao(a.id, 'devolucao');
    await pool.query(
      'UPDATE emprestimos SET data_emprestimo = ?, devolucao_prevista = ? WHERE id = ?',
      [somarDias(hojeEscola(), -8), somarDias(hojeEscola(), -1), b.id],
    );
    const vinculado = await c.agente.patch('/api/v1/me').send({ usuarioId: leitor.id });
    expect(vinculado.status).toBe(200);
    expect(vinculado.body.data).toMatchObject({
      usuarioId: leitor.id,
      matricula: leitor.matricula,
      emprestimosAtivos: 2,
      historicoTotal: 3,
    });
    const semVinculo = await c.agente.patch('/api/v1/me').send({ usuarioId: null });
    expect(semVinculo.body.data).toMatchObject({
      usuarioId: null,
      matricula: null,
      emprestimosAtivos: 0,
      historicoTotal: 0,
    });
    expect(
      (await c.agente.get(`/api/v1/usuarios/${leitor.id}/emprestimos`)).body.resumo
        .totalEmprestimos,
    ).toBe(3);
  });

  test('duas contas disputam o mesmo leitor sem vínculo duplo ou edição parcial', async () => {
    const outra = await criarCenarioBiblioteca();
    try {
      const leitor = await c.usuario();
      const respostas = await Promise.all([
        c.agente.patch('/api/v1/me').send({ usuarioId: leitor.id, telefone: 'A' }),
        outra.agente.patch('/api/v1/me').send({ usuarioId: leitor.id, telefone: 'B' }),
      ]);
      expect(respostas.map((r) => r.status).sort()).toEqual([200, 409]);
      expect(respostas.find((r) => r.status === 409)!.body.error.code).toBe('LEITOR_JA_VINCULADO');
      const perfis = [
        (await c.agente.get('/api/v1/me')).body.data,
        (await outra.agente.get('/api/v1/me')).body.data,
      ];
      expect(perfis.filter((p) => p.usuarioId === leitor.id)).toHaveLength(1);
      expect(perfis.find((p) => p.usuarioId === null).telefone).toBeNull();
    } finally {
      await outra.limpar();
    }
  });

  test('PATCHes simultâneos em contatos diferentes preservam ambos', async () => {
    const respostas = await Promise.all([
      c.agente.patch('/api/v1/me').send({ email: 'concorrente@example.test' }),
      c.agente.patch('/api/v1/me').send({ telefone: '123' }),
    ]);
    expect(respostas.map((r) => r.status)).toEqual([200, 200]);
    expect((await c.agente.get('/api/v1/me')).body.data).toMatchObject({
      email: 'concorrente@example.test',
      telefone: '123',
    });
  });

  test('vínculo e empréstimo concorrentes seguem a mesma ordem de locks', async () => {
    const leitor = await c.usuario();
    const livro = await c.livro();
    const [vinculo, emprestimo] = await Promise.all([
      c.agente.patch('/api/v1/me').send({ usuarioId: leitor.id }),
      c.emprestar(livro.id, leitor.id),
    ]);
    expect(vinculo.status).toBe(200);
    expect(emprestimo.status).toBe(201);
    expect((await c.agente.get('/api/v1/me')).body.data.emprestimosAtivos).toBe(1);
  });

  test('cadastro/login trazem perfil completo e vínculo explícito, inclusive leitor inativo', async () => {
    const leitor = await c.usuario({ status: 'Inativo' });
    const dados = {
      nome: 'Conta com perfil',
      login: `${c.prefixo}-perfil`,
      senha: 'SenhaQat-123',
      email: 'nova@example.test',
      telefone: '123',
      usuarioId: leitor.id,
    };
    const criado = await c.agente.post('/api/v1/funcionarios').send(dados);
    expect(criado.status).toBe(201);
    adicionais.push(criado.body.data.id);
    const esperado = {
      email: dados.email,
      telefone: dados.telefone,
      usuarioId: leitor.id,
      matricula: leitor.matricula,
      cargo: 'Funcionário autorizado',
      emprestimosAtivos: 0,
      historicoTotal: 0,
    };
    expect(criado.body.data).toMatchObject(esperado);
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ login: dados.login, senha: dados.senha });
    expect(login.status).toBe(200);
    expect(login.body).toEqual(criado.body);
    const conflito = await c.agente
      .post('/api/v1/funcionarios')
      .send({ ...dados, login: `${c.prefixo}-outro` });
    expect(conflito.status).toBe(409);
    expect(conflito.body.error.code).toBe('LEITOR_JA_VINCULADO');
    const inexistente = await c.agente
      .post('/api/v1/funcionarios')
      .send({ ...dados, login: `${c.prefixo}-ausente`, usuarioId: 4294967295 });
    expect(inexistente.status).toBe(404);
    const [linhas] = await pool.query('SELECT id FROM funcionarios WHERE login IN (?)', [
      [`${c.prefixo}-outro`, `${c.prefixo}-ausente`],
    ]);
    expect(linhas).toHaveLength(0);
  });
});
