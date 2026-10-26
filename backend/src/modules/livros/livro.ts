import type { RowDataPacket } from 'mysql2/promise';

export interface LivroDados {
  titulo: string;
  autor: string;
  isbn: string | null;
  categoria: string | null;
  anoPublicacao: number | null;
  quantidadeTotal: number;
  quantidadeManutencao: number;
  estante: string | null;
  prateleira: string | null;
}

export interface LivroRow extends RowDataPacket {
  id: number;
  titulo: string;
  autor: string;
  isbn: string | null;
  categoria: string | null;
  ano_publicacao: number | null;
  quantidade_total: number;
  quantidade_manutencao: number;
  quantidade_emprestada?: number;
  estante: string | null;
  prateleira: string | null;
}

// Valida o formato ISBN-10/13, sem verificar o dígito de controle.
export function normalizarIsbn(valor: string | null): string | null {
  if (valor === null || valor.trim() === '') return null;

  const isbn = valor.replace(/[\s-]/g, '').toUpperCase();
  if (!/^(?:\d{13}|\d{9}[\dX])$/.test(isbn)) {
    throw new Error('Informe um ISBN de 10 ou 13 caracteres, ou deixe vazio.');
  }
  return isbn;
}

export function paraLivroApi(livro: LivroRow): LivroDados & {
  id: number;
  quantidadeDisponivel: number;
  status: 'Disponível' | 'Em Manutenção' | 'Esgotado';
} {
  const quantidadeDisponivel =
    livro.quantidade_total - livro.quantidade_manutencao - Number(livro.quantidade_emprestada ?? 0);
  return {
    id: livro.id,
    titulo: livro.titulo,
    autor: livro.autor,
    isbn: livro.isbn,
    categoria: livro.categoria,
    anoPublicacao: livro.ano_publicacao,
    quantidadeTotal: livro.quantidade_total,
    quantidadeManutencao: livro.quantidade_manutencao,
    quantidadeDisponivel,
    status:
      quantidadeDisponivel > 0
        ? 'Disponível'
        : livro.quantidade_manutencao === livro.quantidade_total
          ? 'Em Manutenção'
          : 'Esgotado',
    estante: livro.estante,
    prateleira: livro.prateleira,
  };
}
