import { randomUUID } from 'node:crypto';
import { pool } from '../config/database.js';
import { criarAgenteAutenticado } from './agente-autenticado.js';

export async function criarCenarioBiblioteca() {
  const sessao = await criarAgenteAutenticado();
  const prefixo = `qat-${randomUUID()}`;
  const livros = new Set<number>();
  const usuarios = new Set<number>();
  const emprestimos = new Set<number>();
  return {
    ...sessao,
    prefixo,
    async livro(dados: Record<string, unknown> = {}) {
      const resposta = await sessao.agente
        .post('/api/v1/livros')
        .send({ titulo: `${prefixo} Livro`, autor: 'Autora QAT', quantidadeTotal: 5, ...dados });
      if (resposta.status !== 201)
        throw new Error(`Fixture livro: ${JSON.stringify(resposta.body)}`);
      livros.add(resposta.body.data.id);
      return resposta.body.data;
    },
    async usuario(dados: Record<string, unknown> = {}) {
      const resposta = await sessao.agente
        .post('/api/v1/usuarios')
        .send({ nome: `${prefixo} Leitor`, matricula: randomUUID(), tipo: 'Aluno', ...dados });
      if (resposta.status !== 201)
        throw new Error(`Fixture leitor: ${JSON.stringify(resposta.body)}`);
      usuarios.add(resposta.body.data.id);
      return resposta.body.data;
    },
    async emprestar(
      livroId: number,
      usuarioId: number,
      chave = randomUUID(),
      extras: Record<string, unknown> = {},
    ) {
      const resposta = await sessao.agente
        .post('/api/v1/emprestimos')
        .set('Idempotency-Key', chave)
        .send({ ...extras, livroId, usuarioId });
      if (resposta.status === 201) emprestimos.add(resposta.body.data.id);
      return resposta;
    },
    async acao(id: number, acao: 'renovacoes' | 'devolucao', chave = randomUUID()) {
      return sessao.agente
        .post(`/api/v1/emprestimos/${id}/${acao}`)
        .set('Idempotency-Key', chave)
        .send({});
    },
    async limpar() {
      try {
        if (emprestimos.size) {
          await pool.query('DELETE FROM renovacoes WHERE emprestimo_id IN (?)', [[...emprestimos]]);
          await pool.query('DELETE FROM emprestimos WHERE id IN (?)', [[...emprestimos]]);
        }
        if (livros.size) await pool.query('DELETE FROM livros WHERE id IN (?)', [[...livros]]);
        if (usuarios.size)
          await pool.query('DELETE FROM usuarios WHERE id IN (?)', [[...usuarios]]);
      } finally {
        await sessao.limpar();
      }
    },
  };
}
