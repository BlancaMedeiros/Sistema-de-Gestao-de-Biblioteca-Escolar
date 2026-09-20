export interface Usuario {
  id: number;
  nome: string;
  email: string;
  matricula: string;
  tipo: 'Aluno' | 'Professor' | 'Bibliotecário';
  status: 'Ativo' | 'Inativo';
  dataCadastro: string;
}