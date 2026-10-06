export interface Usuario {
  id: number;
  nome: string;
  telefone: string;
  email: string;
  matricula: string;
  tipo: 'Aluno' | 'Professor' | 'Bibliotecário';
  status: 'Ativo' | 'Inativo';
  dataCadastro: string;
}