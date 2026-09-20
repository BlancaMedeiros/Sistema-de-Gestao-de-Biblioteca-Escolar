export interface UsuarioPerfil {
  id: number;
  nome: string;
  email: string;
  telefone: string;
  matricula: string;
  cargo: string; // ex: 'Administrador', 'Bibliotecário', 'Leitor'
  emprestimosAtivos: number;
  historicoTotal: number;
}