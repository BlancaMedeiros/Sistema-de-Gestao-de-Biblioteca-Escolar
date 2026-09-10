export interface Livro {
  id: number;
  titulo: string;
  autor: string;
  isbn: string;
  categoria: string;
  anoPublicacao: number;
  quantidadeTotal: number;
  quantidadeDisponivel: number;
  status: 'Disponível' | 'Esgotado' | 'Em Manutenção';
}