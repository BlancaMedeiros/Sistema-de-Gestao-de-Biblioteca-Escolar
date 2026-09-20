export interface EmprestimoRecente {
  id: number;
  livro: string;
  usuario: string;
  dataEmprestimo: string;
  devolucaoPrevista: string;
  status: 'Em Andamento' | 'Atrasado' | 'Devolvido';
}