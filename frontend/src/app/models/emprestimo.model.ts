export interface Emprestimo {
  id: number;
  livroId: number;
  livroTitulo: string;
  usuarioId: number;
  usuarioNome: string;
  dataEmprestimo: string;
  devolucaoPrevista: string;
  devolucaoReal?: string;
  status: 'Em Andamento' | 'Atrasado' | 'Devolvido';
}