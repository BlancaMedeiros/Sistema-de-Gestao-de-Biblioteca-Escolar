// QAT por HTTP real, com processo próprio e fixtures removidas ao final.
// Execute após o build: npm run qat:http --prefix backend
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout } from 'node:timers/promises';
import { loadLocalEnv, repoRootDir } from '../dist/config/local-env.js';

loadLocalEnv();
assert.notEqual(process.env.NODE_ENV, 'production', 'QAT permitido somente em desenvolvimento.');
assert.equal(process.env.DB_HOST, '127.0.0.1', 'QAT exige banco local IPv4.');
assert.ok(!process.env.DB_SOCKET_PATH, 'QAT não aceita socket de banco externo.');
const { pool } = await import('../dist/config/database.js');
const { createFuncionario } = await import('../dist/modules/auth/funcionarios.repository.js');
const { hashPassword } = await import('../dist/modules/auth/password.js');
const { hojeEscola, somarDias } = await import('../dist/utils/datas.js');
const script = fileURLToPath(import.meta.url);
const port = Number(process.env.QAT_PORT ?? 3007);
assert.ok(Number.isInteger(port) && port >= 1024 && port <= 65535);
const base = `http://127.0.0.1:${port}`;

if (process.argv.includes('--servidor')) {
  const { app } = await import('../dist/app.js');
  app.listen(port, '127.0.0.1');
} else {
  const prefixo = `qat-${randomUUID()}`;
  const senha = randomUUID();
  const funcionarios = new Set();
  const livros = new Set();
  const usuarios = new Set();
  const emprestimos = new Set();
  const sessao = {};
  const casos = [];
  const requisicoes = [];
  let servidor;
  let casoAtual;
  let livro;
  let usuario;
  let emprestimo;
  let criacao;
  let renovacao;
  let devolucao;
  let operadora;
  let metricas;
  const chaveCriacao = randomUUID();
  const chaveRenovacao = randomUUID();
  const chaveDevolucao = randomUUID();
  const saida = resolve(repoRootDir, process.env.QAT_OUTPUT ?? 'tmp/qat-http.json');
  const relatorio = {
    inicio: new Date().toISOString(),
    metodo: 'HTTP real automatizado, processo próprio',
    banco: { host: process.env.DB_HOST, porta: process.env.DB_PORT, nome: process.env.DB_NAME },
    casos,
    requisicoes,
  };

  async function parar() {
    if (servidor && servidor.exitCode === null) {
      const encerrado = once(servidor, 'exit');
      servidor.kill();
      await encerrado;
    }
  }
  async function iniciar() {
    servidor = spawn(process.execPath, [script, '--servidor'], {
      cwd: repoRootDir,
      env: { ...process.env, NODE_ENV: 'development' },
      stdio: 'ignore',
      windowsHide: true,
    });
    for (let i = 0; i < 100; i++) {
      if (servidor.exitCode !== null)
        throw Error('O processo próprio da API não iniciou; confira a porta QAT_PORT.');
      try {
        if ((await fetch(`${base}/api/ready`)).ok) return;
      } catch {}
      await setTimeout(100);
    }
    throw Error('Tempo excedido ao aguardar a API do QAT.');
  }
  async function chamar(caminho, metodo = 'GET', corpo, chave, cliente = sessao, headers = {}) {
    const resposta = await fetch(`${base}/api/v1${caminho}`, {
      method: metodo,
      signal: AbortSignal.timeout(15000),
      headers: {
        ...(cliente.cookie ? { cookie: cliente.cookie } : {}),
        ...(corpo !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(chave ? { 'Idempotency-Key': chave } : {}),
        ...headers,
      },
      ...(corpo !== undefined
        ? { body: typeof corpo === 'string' ? corpo : JSON.stringify(corpo) }
        : {}),
    });
    const body = resposta.status === 204 ? null : await resposta.json();
    if (resposta.headers.get('set-cookie'))
      cliente.cookie = resposta.headers.get('set-cookie').split(';')[0];
    const id = body?.data?.id;
    if (resposta.status === 201 && id) {
      ({
        '/livros': livros,
        '/usuarios': usuarios,
        '/emprestimos': emprestimos,
        '/funcionarios': funcionarios,
      })[caminho]?.add(id);
    }
    // Sem corpos de autenticação, cookies, dados pessoais ou hashes no relatório.
    requisicoes.push({
      caso: casoAtual,
      metodo,
      caminho,
      status: resposta.status,
      ...(id ? { id } : {}),
      ...(body?.error ? { erro: body.error.code } : {}),
      ...(body?.pagination ? { pagination: body.pagination } : {}),
    });
    return { status: resposta.status, body };
  }
  async function esperar(caminho, metodo, corpo, status, codigo, chave, cliente) {
    const resposta = await chamar(caminho, metodo, corpo, chave, cliente);
    assert.equal(resposta.status, status, `${metodo} ${caminho}`);
    if (codigo) assert.equal(resposta.body.error.code, codigo);
    return resposta;
  }
  async function caso(id, descricao, executar) {
    casoAtual = id;
    const registro = { id, descricao, resultado: 'em execução' };
    casos.push(registro);
    await executar();
    registro.resultado = 'aprovado';
  }
  async function novoUsuario() {
    return (
      await esperar(
        '/usuarios',
        'POST',
        { nome: prefixo, matricula: randomUUID(), tipo: 'Aluno' },
        201,
      )
    ).body.data;
  }
  async function novoLivro(total = 6) {
    return (
      await esperar(
        '/livros',
        'POST',
        { titulo: `${prefixo} Memórias %_!`, autor: 'Autora QAT', quantidadeTotal: total },
        201,
      )
    ).body.data;
  }
  const acao = (id, nome, chave = randomUUID()) =>
    chamar(`/emprestimos/${id}/${nome}`, 'POST', {}, chave);
  const emprestar = (livroId, usuarioId, chave = randomUUID()) =>
    chamar('/emprestimos', 'POST', { livroId, usuarioId }, chave);

  try {
    // Não usa uma API já existente na porta: somente o processo criado pelo QAT.
    const { createServer } = await import('node:net');
    const reserva = createServer();
    await new Promise((ok, falha) => {
      reserva.once('error', falha);
      reserva.listen(port, '127.0.0.1', ok);
    });
    await new Promise((ok, falha) => reserva.close((erro) => (erro ? falha(erro) : ok())));
    const [versao] = await pool.query('SELECT VERSION() AS versao');
    relatorio.banco.versao = versao[0].versao;
    operadora = await createFuncionario(pool, {
      nome: 'Operadora QAT',
      login: prefixo,
      senhaHash: await hashPassword(senha),
    });
    funcionarios.add(operadora.id);
    await iniciar();

    await caso('API-01', 'login válido, inválido e incompleto', async () => {
      await esperar('/auth/login', 'POST', {}, 422, 'DADOS_INVALIDOS');
      await esperar(
        '/auth/login',
        'POST',
        { login: prefixo, senha: 'incorreta' },
        401,
        'CREDENCIAIS_INVALIDAS',
      );
      await esperar('/auth/login', 'POST', { login: prefixo, senha }, 200);
    });
    await caso('API-03', 'perfil da sessão sem dados privados', async () => {
      const r = await esperar('/me', 'GET', undefined, 200);
      assert.deepEqual(Object.keys(r.body.data).sort(), ['id', 'login', 'nome']);
      assert.equal(r.body.data.id, operadora.id);
    });
    await caso('API-04', 'perfil parcial e limites do nome', async () => {
      await esperar('/me', 'PATCH', { nome: 'x'.repeat(121) }, 422, 'DADOS_INVALIDOS');
      await esperar('/me', 'PATCH', { nome: '' }, 422, 'DADOS_INVALIDOS');
      const r = await esperar(
        '/me',
        'PATCH',
        { nome: 'Operadora Atualizada', login: 'ignorado' },
        200,
      );
      assert.equal(r.body.data.login, prefixo);
      assert.equal((await chamar('/me')).body.data.nome, 'Operadora Atualizada');
    });
    await caso('API-05', 'troca de senha e invalidação de outra sessão', async () => {
      const outra = {};
      await esperar(
        '/auth/login',
        'POST',
        { login: prefixo, senha },
        200,
        undefined,
        undefined,
        outra,
      );
      await esperar(
        '/me/senha',
        'PUT',
        { senhaAtual: 'errada', novaSenha: senha },
        401,
        'SENHA_ATUAL_INVALIDA',
      );
      await esperar(
        '/me/senha',
        'PUT',
        { senhaAtual: senha, novaSenha: 'curta' },
        422,
        'DADOS_INVALIDOS',
      );
      const nova = randomUUID();
      await esperar('/me/senha', 'PUT', { senhaAtual: senha, novaSenha: nova }, 204);
      await esperar('/me', 'GET', undefined, 401, 'NAO_AUTENTICADO', undefined, outra);
      await esperar(
        '/auth/login',
        'POST',
        { login: prefixo, senha },
        401,
        'CREDENCIAIS_INVALIDAS',
        undefined,
        outra,
      );
      await esperar(
        '/auth/login',
        'POST',
        { login: prefixo, senha: nova },
        200,
        undefined,
        undefined,
        outra,
      );
      await esperar('/me', 'GET', undefined, 200);
    });
    await caso('API-06', 'funcionário, duplicidade e login da nova conta', async () => {
      const dados = { nome: 'Auxiliar QAT', login: `${prefixo}-2`, senha };
      const r = await esperar('/funcionarios', 'POST', dados, 201);
      assert.deepEqual(Object.keys(r.body.data).sort(), ['id', 'login', 'nome']);
      await esperar('/funcionarios', 'POST', dados, 409, 'LOGIN_DUPLICADO');
      await esperar(
        '/funcionarios',
        'POST',
        { ...dados, login: 'com espaço' },
        422,
        'DADOS_INVALIDOS',
      );
      await esperar(
        '/auth/login',
        'POST',
        { login: dados.login, senha },
        200,
        undefined,
        undefined,
        {},
      );
    });
    metricas = (await chamar('/dashboard')).body.data.metricas;
    await caso('API-07', 'cadastro de livro e validação', async () => {
      livro = await novoLivro();
      assert.equal(livro.quantidadeDisponivel, 6);
      await esperar(
        '/livros',
        'POST',
        { titulo: '', autor: 'QAT', quantidadeTotal: 1 },
        422,
        'DADOS_INVALIDOS',
      );
    });
    await caso('API-08', 'busca literal e sem acento', async () => {
      const r = await esperar(
        `/livros?busca=${encodeURIComponent(`${prefixo} memorias %_!`)}`,
        'GET',
        undefined,
        200,
      );
      assert.deepEqual(
        r.body.data.map((x) => x.id),
        [livro.id],
      );
    });
    await caso('API-09', 'livro persistido e ID inválido', async () => {
      assert.equal((await chamar(`/livros/${livro.id}`)).body.data.id, livro.id);
      await esperar('/livros/0', 'GET', undefined, 404, 'LIVRO_NAO_ENCONTRADO');
    });
    await caso('API-10', 'edição parcial e saldo sem gravação inválida', async () => {
      await esperar(
        `/livros/${livro.id}`,
        'PATCH',
        { categoria: 'QAT', quantidadeManutencao: 1 },
        200,
      );
      await esperar(`/livros/${livro.id}`, 'PATCH', { quantidadeTotal: 0 }, 422, 'DADOS_INVALIDOS');
      const r = await esperar(`/livros/${livro.id}`, 'PATCH', { categoria: null }, 200);
      assert.equal(r.body.data.categoria, null);
      assert.equal(r.body.data.quantidadeDisponivel, 5);
      assert.equal(r.body.data.autor, livro.autor);
    });
    await caso('API-12', 'leitor, matrícula única e campos inválidos', async () => {
      usuario = await novoUsuario();
      await esperar(
        '/usuarios',
        'POST',
        { nome: prefixo, matricula: usuario.matricula, tipo: 'Aluno' },
        409,
        'MATRICULA_DUPLICADA',
      );
      await esperar('/usuarios', 'POST', { nome: prefixo }, 422, 'DADOS_INVALIDOS');
    });
    await caso('API-13', 'listagem de leitores com filtros e paginação', async () => {
      const r = await esperar(
        `/usuarios?busca=${prefixo}&tipo=Aluno&status=Ativo&pageSize=1`,
        'GET',
        undefined,
        200,
      );
      assert.equal(r.body.pagination.total, 1);
      assert.equal(r.body.data[0].id, usuario.id);
    });
    await caso('API-14', 'consulta de leitor e ID inválido', async () => {
      assert.equal((await chamar(`/usuarios/${usuario.id}`)).body.data.id, usuario.id);
      await esperar('/usuarios/0', 'GET', undefined, 404, 'USUARIO_NAO_ENCONTRADO');
    });
    await caso('API-15', 'PATCH de leitor preserva omitidos e limpa opcional', async () => {
      await esperar(`/usuarios/${usuario.id}`, 'PATCH', { turma: '5A' }, 200);
      const r = await esperar(`/usuarios/${usuario.id}`, 'PATCH', { turma: null }, 200);
      assert.equal(r.body.data.turma, null);
      assert.equal(r.body.data.matricula, usuario.matricula);
    });
    await caso('API-17', 'empréstimo com datas e operador do servidor', async () => {
      criacao = await esperar(
        '/emprestimos',
        'POST',
        {
          livroId: livro.id,
          usuarioId: usuario.id,
          dataEmprestimo: '2000-01-01',
          funcionarioId: 1,
        },
        201,
        undefined,
        chaveCriacao,
      );
      emprestimo = criacao.body.data;
      assert.equal(emprestimo.dataEmprestimo, hojeEscola());
      assert.equal(emprestimo.devolucaoPrevista, somarDias(hojeEscola(), 7));
      assert.equal(emprestimo.funcionarioId, operadora.id);
      assert.equal((await chamar(`/livros/${livro.id}`)).body.data.quantidadeDisponivel, 4);
    });
    await caso('API-16', 'histórico do leitor com resumo independente de filtro', async () => {
      const r = await esperar(
        `/usuarios/${usuario.id}/emprestimos?status=Devolvido`,
        'GET',
        undefined,
        200,
      );
      assert.equal(r.body.pagination.total, 0);
      assert.equal(r.body.resumo.emprestimosAtivos, 1);
    });
    await caso('API-18', 'filtros combinados de empréstimos', async () => {
      const r = await esperar(
        `/emprestimos?usuarioId=${usuario.id}&livroId=${livro.id}&status=Abertos&pageSize=1`,
        'GET',
        undefined,
        200,
      );
      assert.equal(r.body.pagination.total, 1);
      assert.equal(r.body.data[0].id, emprestimo.id);
    });
    await caso('API-19', 'consulta de empréstimo e ID inválido', async () => {
      assert.equal(
        (await chamar(`/emprestimos/${emprestimo.id}`)).body.data.status,
        'Em Andamento',
      );
      await esperar('/emprestimos/0', 'GET', undefined, 404, 'EMPRESTIMO_NAO_ENCONTRADO');
    });
    await caso('API-22', 'dashboard conciliado antes/depois', async () => {
      const m = (await esperar('/dashboard', 'GET', undefined, 200)).body.data.metricas;
      assert.equal(m.totalAcervo, metricas.totalAcervo + 6);
      assert.equal(m.usuariosAtivos, metricas.usuariosAtivos + 1);
      assert.equal(m.emprestimosAtivos, metricas.emprestimosAtivos + 1);
    });
    await caso('API-23', 'pendências e rejeição de filtro Devolvido', async () => {
      const r = await esperar(
        `/relatorios/pendencias?usuarioId=${usuario.id}`,
        'GET',
        undefined,
        200,
      );
      assert.equal(r.body.pagination.total, 1);
      await esperar(
        '/relatorios/pendencias?status=Devolvido',
        'GET',
        undefined,
        422,
        'DADOS_INVALIDOS',
      );
    });
    await caso('REG-05a', 'bloqueio de inativação com empréstimo aberto', async () => {
      await esperar(
        `/usuarios/${usuario.id}`,
        'PATCH',
        { status: 'Inativo' },
        409,
        'USUARIO_COM_EMPRESTIMOS',
      );
      await esperar(`/livros/${livro.id}`, 'DELETE', undefined, 409, 'LIVRO_COM_EMPRESTIMOS');
    });
    await caso('API-20', 'duas renovações e rejeição da terceira', async () => {
      renovacao = await esperar(
        `/emprestimos/${emprestimo.id}/renovacoes`,
        'POST',
        {},
        200,
        undefined,
        chaveRenovacao,
      );
      assert.equal(
        renovacao.body.data.devolucaoPrevista,
        somarDias(emprestimo.devolucaoPrevista, 7),
      );
      assert.deepEqual(await acao(emprestimo.id, 'renovacoes', chaveRenovacao), renovacao);
      assert.equal((await acao(emprestimo.id, 'renovacoes')).body.data.quantidadeRenovacoes, 2);
      assert.equal((await acao(emprestimo.id, 'renovacoes')).body.error.code, 'LIMITE_RENOVACOES');
    });
    await caso(
      'REG-06',
      'idempotência de cadastro, corpo divergente e header obrigatório',
      async () => {
        assert.deepEqual(await emprestar(livro.id, usuario.id, chaveCriacao), criacao);
        await esperar(
          '/emprestimos',
          'POST',
          { livroId: livro.id, usuarioId: usuario.id + 1 },
          409,
          'CHAVE_IDEMPOTENCIA_REUTILIZADA',
          chaveCriacao,
        );
        await esperar(
          '/emprestimos',
          'POST',
          { livroId: livro.id, usuarioId: usuario.id },
          422,
          'DADOS_INVALIDOS',
        );
      },
    );
    await caso('REG-09', 'reinício real preserva sessão, registros e idempotência', async () => {
      await parar();
      await iniciar();
      await esperar('/me', 'GET', undefined, 200);
      assert.equal(
        (await chamar(`/emprestimos/${emprestimo.id}`)).body.data.quantidadeRenovacoes,
        2,
      );
      assert.deepEqual(await emprestar(livro.id, usuario.id, chaveCriacao), criacao);
      assert.deepEqual(await acao(emprestimo.id, 'renovacoes', chaveRenovacao), renovacao);
    });
    await caso('API-21', 'devolução, repetição e recomposição do saldo', async () => {
      devolucao = await esperar(
        `/emprestimos/${emprestimo.id}/devolucao`,
        'POST',
        {},
        200,
        undefined,
        chaveDevolucao,
      );
      assert.equal(devolucao.body.data.devolvidoPor, operadora.id);
      assert.equal(devolucao.body.data.devolucaoReal, hojeEscola());
      assert.deepEqual(await acao(emprestimo.id, 'devolucao', chaveDevolucao), devolucao);
      assert.equal(
        (await acao(emprestimo.id, 'devolucao')).body.error.code,
        'EMPRESTIMO_DEVOLVIDO',
      );
      assert.equal((await chamar(`/livros/${livro.id}`)).body.data.quantidadeDisponivel, 5);
      assert.equal(
        (await chamar(`/relatorios/pendencias?usuarioId=${usuario.id}`)).body.pagination.total,
        0,
      );
    });
    await caso('REG-01', 'limite de três e liberação após devolver', async () => {
      const ids = [];
      for (let i = 0; i < 3; i++) {
        const r = await emprestar(livro.id, usuario.id);
        assert.equal(r.status, 201);
        ids.push(r.body.data.id);
      }
      assert.equal((await emprestar(livro.id, usuario.id)).body.error.code, 'LIMITE_EMPRESTIMOS');
      await acao(ids.shift(), 'devolucao');
      const novo = await emprestar(livro.id, usuario.id);
      assert.equal(novo.status, 201);
      ids.push(novo.body.data.id);
      for (const id of ids) assert.equal((await acao(id, 'devolucao')).status, 200);
    });
    await caso('REG-03', 'atraso bloqueia emprestar/renovar até devolver', async () => {
      const atrasado = (await emprestar(livro.id, usuario.id)).body.data;
      const emDia = (await emprestar(livro.id, usuario.id)).body.data;
      await pool.query(
        'UPDATE emprestimos SET data_emprestimo = ?, devolucao_prevista = ? WHERE id = ?',
        [somarDias(hojeEscola(), -14), somarDias(hojeEscola(), -1), atrasado.id],
      );
      assert.equal((await chamar(`/emprestimos/${atrasado.id}`)).body.data.status, 'Atrasado');
      assert.equal((await emprestar(livro.id, usuario.id)).body.error.code, 'USUARIO_COM_ATRASOS');
      assert.equal((await acao(emDia.id, 'renovacoes')).body.error.code, 'USUARIO_COM_ATRASOS');
      assert.equal((await acao(atrasado.id, 'devolucao')).status, 200);
      assert.equal((await acao(emDia.id, 'renovacoes')).status, 200);
      assert.equal((await acao(emDia.id, 'devolucao')).status, 200);
    });
    await caso('REG-07', 'HTTP concorrente disputa a última unidade', async () => {
      const unico = await novoLivro(1);
      const outro = await novoUsuario();
      const r = await Promise.all([emprestar(unico.id, usuario.id), emprestar(unico.id, outro.id)]);
      assert.deepEqual(r.map((x) => x.status).sort(), [201, 409]);
      assert.equal((await chamar(`/livros/${unico.id}`)).body.data.status, 'Esgotado');
      assert.equal(
        (await acao(r.find((x) => x.status === 201).body.data.id, 'devolucao')).status,
        200,
      );
    });
    await caso('REG-12', 'paginação estável, busca literal e filtros inválidos', async () => {
      const primeira = await chamar(`/usuarios?busca=${prefixo}&pageSize=1`);
      const segunda = await chamar(`/usuarios?busca=${prefixo}&pageSize=1&page=2`);
      assert.equal(primeira.body.pagination.total, 2);
      assert.notEqual(primeira.body.data[0].id, segunda.body.data[0].id);
      await esperar('/usuarios?page=1&page=2', 'GET', undefined, 422, 'DADOS_INVALIDOS');
      await esperar(
        '/emprestimos?vencimentoDe=2026-02-30',
        'GET',
        undefined,
        422,
        'DADOS_INVALIDOS',
      );
    });
    await caso('API-11', 'inativação após devolução preserva histórico', async () => {
      await esperar(`/livros/${livro.id}`, 'DELETE', undefined, 204);
      await esperar(`/livros/${livro.id}`, 'GET', undefined, 404, 'LIVRO_NAO_ENCONTRADO');
      await esperar(`/livros/${livro.id}`, 'DELETE', undefined, 404, 'LIVRO_NAO_ENCONTRADO');
      assert.equal((await chamar(`/emprestimos/${emprestimo.id}`)).body.data.status, 'Devolvido');
      await esperar(`/usuarios/${usuario.id}`, 'PATCH', { status: 'Inativo' }, 200);
      await esperar(
        '/usuarios',
        'POST',
        { nome: prefixo, matricula: usuario.matricula, tipo: 'Aluno' },
        409,
        'MATRICULA_DUPLICADA',
      );
      await esperar(`/usuarios/${usuario.id}`, 'PATCH', { status: 'Ativo' }, 200);
    });
    await caso('REG-14', '400, 413 e 415 por HTTP real', async () => {
      await esperar('/auth/login', 'POST', '{', 400, 'REQUISICAO_INVALIDA');
      await esperar(
        '/auth/login',
        'POST',
        { login: 'x'.repeat(101 * 1024) },
        413,
        'REQUISICAO_INVALIDA',
      );
      assert.equal(
        (
          await chamar(
            '/auth/login',
            'POST',
            {},
            undefined,
            {},
            { 'content-type': 'application/json; charset=iso-8859-1' },
          )
        ).status,
        415,
      );
    });
    await caso('API-02', 'logout invalida a sessão usada', async () => {
      await esperar('/auth/logout', 'POST', undefined, 204);
      await esperar('/me', 'GET', undefined, 401, 'NAO_AUTENTICADO');
    });
    await caso('REG-13', 'áreas protegidas rejeitam cliente sem sessão', async () => {
      for (const rota of [
        '/livros',
        '/usuarios',
        '/emprestimos',
        '/dashboard',
        '/relatorios/pendencias',
      ])
        await esperar(rota, 'GET', undefined, 401, 'NAO_AUTENTICADO');
      await esperar('/funcionarios', 'POST', {}, 401, 'NAO_AUTENTICADO');
    });
    assert.equal(casos.filter((x) => x.id.startsWith('API-')).length, 23);
    relatorio.resultado = 'aprovado';
  } catch (erro) {
    relatorio.resultado = 'reprovado';
    const ultimo = casos.at(-1);
    if (ultimo?.resultado === 'em execução') ultimo.resultado = 'reprovado';
    relatorio.falha = erro.message;
    process.exitCode = 1;
  } finally {
    await parar();
    try {
      for (const id of emprestimos) {
        await pool.query('DELETE FROM renovacoes WHERE emprestimo_id = ?', [id]);
        await pool.query('DELETE FROM emprestimos WHERE id = ?', [id]);
      }
      for (const id of livros) await pool.query('DELETE FROM livros WHERE id = ?', [id]);
      for (const id of usuarios) await pool.query('DELETE FROM usuarios WHERE id = ?', [id]);
      for (const id of funcionarios) {
        await pool.query('DELETE FROM idempotencia WHERE funcionario_id = ?', [id]);
        await pool.query("DELETE FROM sessoes WHERE JSON_EXTRACT(dados, '$.funcionarioId') = ?", [
          id,
        ]);
        await pool.query('DELETE FROM funcionarios WHERE id = ?', [id]);
      }
      relatorio.limpeza = 'fixtures próprias removidas';
    } catch (erro) {
      relatorio.limpeza = 'falhou; investigar fixtures da rodada';
      relatorio.resultado = 'reprovado';
      process.exitCode = 1;
    }
    await pool.end();
    relatorio.fim = new Date().toISOString();
    await mkdir(dirname(saida), { recursive: true });
    await writeFile(saida, `${JSON.stringify(relatorio, null, 2)}\n`);
    console.log(
      JSON.stringify({
        resultado: relatorio.resultado,
        casos: casos.length,
        requisicoes: requisicoes.length,
        evidencia: saida,
        limpeza: relatorio.limpeza,
        falha: relatorio.falha,
      }),
    );
  }
}
