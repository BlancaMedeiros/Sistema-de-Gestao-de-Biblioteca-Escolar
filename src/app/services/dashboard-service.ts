import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { MetricasDashboard } from '../models/metricas-dashboard.model';
import { EmprestimoRecente } from '../models/emprestimo-recente.model';
import { Livro } from '../models/livro.model';
import { Emprestimo } from '../models/emprestimo.model';
import { Usuario } from '../models/usuario.model';


@Injectable({
  providedIn: 'root'
})
export class DashboardService {

  private mockAcervo: Livro[] = [
    { id: 1, titulo: 'Dom Casmurro', autor: 'Machado de Assis', isbn: '9788535902778', categoria: 'Literatura Brasileira', anoPublicacao: 1899, quantidadeTotal: 5, quantidadeDisponivel: 3, status: 'Disponível' },
    { id: 2, titulo: 'O Cortiço', autor: 'Aluísio Azevedo', isbn: '9788508041534', categoria: 'Naturalismo', anoPublicacao: 1890, quantidadeTotal: 4, quantidadeDisponivel: 1, status: 'Disponível' },
    { id: 3, titulo: 'Memórias Póstumas de Brás Cubas', autor: 'Machado de Assis', isbn: '9788520932223', categoria: 'Literatura Brasileira', anoPublicacao: 1881, quantidadeTotal: 3, quantidadeDisponivel: 0, status: 'Esgotado' },
    { id: 4, titulo: 'A Hora da Estrela', autor: 'Clarice Lispector', isbn: '9788535905090', categoria: 'Romance', anoPublicacao: 1977, quantidadeTotal: 6, quantidadeDisponivel: 4, status: 'Disponível' },
    { id: 5, titulo: 'Vidas Secas', autor: 'Graciliano Ramos', isbn: '9788501008788', categoria: 'Regionalismo', anoPublicacao: 1938, quantidadeTotal: 5, quantidadeDisponivel: 2, status: 'Disponível' },
    { id: 6, titulo: 'Capitães da Areia', autor: 'Jorge Amado', isbn: '9788535914061', categoria: 'Romance', anoPublicacao: 1937, quantidadeTotal: 4, quantidadeDisponivel: 0, status: 'Esgotado' },
    { id: 7, titulo: 'Grande Sertão: Veredas', autor: 'João Guimarães Rosa', isbn: '9788520938348', categoria: 'Literatura Brasileira', anoPublicacao: 1956, quantidadeTotal: 2, quantidadeDisponivel: 1, status: 'Disponível' },
    { id: 8, titulo: 'Iracema', autor: 'José de Alencar', isbn: '9788508040773', categoria: 'Romanticismo', anoPublicacao: 1865, quantidadeTotal: 3, quantidadeDisponivel: 3, status: 'Disponível' },
    { id: 9, titulo: 'O Alquimista', autor: 'Paulo Coelho', isbn: '9788575427583', categoria: 'Ficção', anoPublicacao: 1988, quantidadeTotal: 4, quantidadeDisponivel: 0, status: 'Em Manutenção' },
    { id: 10, titulo: 'Triste Fim de Policarpo Quaresma', autor: 'Lima Barreto', isbn: '9788520931561', categoria: 'Pré-Modernismo', anoPublicacao: 1915, quantidadeTotal: 3, quantidadeDisponivel: 2, status: 'Disponível' }
  ];

  private mockEmprestimos: Emprestimo[] = [
    { id: 1, livroId: 1, livroTitulo: 'Dom Casmurro', usuarioId: 1, usuarioNome: 'Lucas Andrade', dataEmprestimo: '01/09/2026', devolucaoPrevista: '15/09/2026', status: 'Em Andamento' },
    { id: 2, livroId: 2, livroTitulo: 'O Cortiço', usuarioId: 2, usuarioNome: 'Beatriz Lima', dataEmprestimo: '25/08/2026', devolucaoPrevista: '08/09/2026', status: 'Em Andamento' },
    { id: 3, livroId: 3, livroTitulo: 'Memórias Póstumas de Brás Cubas', usuarioId: 3, usuarioNome: 'Gabriel Santos', dataEmprestimo: '10/08/2026', devolucaoPrevista: '24/08/2026', status: 'Atrasado' },
    { id: 4, livroId: 4, livroTitulo: 'A Hora da Estrela', usuarioId: 4, usuarioNome: 'Mariana Costa', dataEmprestimo: '15/08/2026', devolucaoPrevista: '29/08/2026', devolucaoReal: '28/08/2026', status: 'Devolvido' },
    { id: 5, livroId: 5, livroTitulo: 'Vidas Secas', usuarioId: 5, usuarioNome: 'Rafael Oliveira', dataEmprestimo: '02/09/2026', devolucaoPrevista: '16/09/2026', status: 'Em Andamento' },
    { id: 6, livroId: 6, livroTitulo: 'Capitães da Areia', usuarioId: 6, usuarioNome: 'Camila Fernandes', dataEmprestimo: '05/08/2026', devolucaoPrevista: '19/08/2026', status: 'Atrasado' },
    { id: 7, livroId: 7, livroTitulo: 'Grande Sertão: Veredas', usuarioId: 7, usuarioNome: 'Thiago Martins', dataEmprestimo: '20/08/2026', devolucaoPrevista: '03/09/2026', status: 'Em Andamento' },
    { id: 8, livroId: 8, livroTitulo: 'Iracema', usuarioId: 8, usuarioNome: 'Juliana Rocha', dataEmprestimo: '12/08/2026', devolucaoPrevista: '26/08/2026', devolucaoReal: '25/08/2026', status: 'Devolvido' },
    { id: 9, livroId: 9, livroTitulo: 'O Alquimista', usuarioId: 9, usuarioNome: 'Felipe Barbosa', dataEmprestimo: '03/09/2026', devolucaoPrevista: '17/09/2026', status: 'Em Andamento' },
    { id: 10, livroId: 10, livroTitulo: 'Triste Fim de Policarpo Quaresma', usuarioId: 10, usuarioNome: 'Amanda Souza', dataEmprestimo: '18/08/2026', devolucaoPrevista: '01/09/2026', status: 'Atrasado' }
  ];

  private mockUsuarios: Usuario[] = [
    { id: 1, nome: 'Lucas Andrade', email: 'lucas.andrade@escola.com', matricula: 'ALU-202601', tipo: 'Aluno', status: 'Ativo', dataCadastro: '10/02/2026' },
    { id: 2, nome: 'Beatriz Lima', email: 'beatriz.lima@escola.com', matricula: 'ALU-202602', tipo: 'Aluno', status: 'Ativo', dataCadastro: '12/02/2026' },
    { id: 3, nome: 'Gabriel Santos', email: 'gabriel.santos@escola.com', matricula: 'ALU-202603', tipo: 'Aluno', status: 'Ativo', dataCadastro: '15/02/2026' },
    { id: 4, nome: 'Mariana Costa', email: 'mariana.costa@escola.com', matricula: 'PROF-1020', tipo: 'Professor', status: 'Ativo', dataCadastro: '01/01/2026' },
    { id: 5, nome: 'Rafael Oliveira', email: 'rafael.oliveira@escola.com', matricula: 'ALU-202604', tipo: 'Aluno', status: 'Ativo', dataCadastro: '18/02/2026' },
    { id: 6, nome: 'Camila Fernandes', email: 'camila.fernandes@escola.com', matricula: 'ALU-202605', tipo: 'Aluno', status: 'Inativo', dataCadastro: '20/02/2026' },
    { id: 7, nome: 'Thiago Martins', email: 'thiago.martins@escola.com', matricula: 'PROF-1021', tipo: 'Professor', status: 'Ativo', dataCadastro: '05/01/2026' },
    { id: 8, nome: 'Juliana Rocha', email: 'juliana.rocha@escola.com', matricula: 'BIB-0001', tipo: 'Bibliotecário', status: 'Ativo', dataCadastro: '01/12/2025' },
    { id: 9, nome: 'Felipe Barbosa', email: 'felipe.barbosa@escola.com', matricula: 'ALU-202606', tipo: 'Aluno', status: 'Ativo', dataCadastro: '01/03/2026' },
    { id: 10, nome: 'Amanda Souza', email: 'amanda.souza@escola.com', matricula: 'ALU-202607', tipo: 'Aluno', status: 'Ativo', dataCadastro: '05/03/2026' }
  ];

  constructor() { }

  // --- MÉTODOS DO DASHBOARD ---
  getMetricas(): Observable<MetricasDashboard> {
    return of({
      totalAcervo: 1240,
      emprestimosAtivos: 48,
      devolucoesPendentes: 5,
      usuariosAtivos: 310
    });
  }

  getUltimosEmprestimos(): Observable<EmprestimoRecente[]> {
    return of([
      { id: 1, livro: 'Dom Casmurro', usuario: 'Maria Silva', dataEmprestimo: '01/09/2026', devolucaoPrevista: '15/09/2026', status: 'Em Andamento' },
      { id: 2, livro: 'O Cortiço', usuario: 'João Santos', dataEmprestimo: '25/08/2026', devolucaoPrevista: '08/09/2026', status: 'Em Andamento' },
      { id: 3, livro: 'Memórias Póstumas de Brás Cubas', usuario: 'Ana Souza', dataEmprestimo: '10/08/2026', devolucaoPrevista: '24/08/2026', status: 'Atrasado' },
      { id: 4, livro: 'A Hora da Estrela', usuario: 'Carlos Lima', dataEmprestimo: '15/08/2026', devolucaoPrevista: '29/08/2026', status: 'Devolvido' }
    ]);
  }

  // --- MÉTODOS PARA AS OUTRAS TELAS ---
  getAcervo(): Observable<Livro[]> {
    return of(this.mockAcervo);
  }

  getEmprestimos(): Observable<Emprestimo[]> {
    return of(this.mockEmprestimos);
  }

  getUsuarios(): Observable<Usuario[]> {
    return of(this.mockUsuarios);
  }
}