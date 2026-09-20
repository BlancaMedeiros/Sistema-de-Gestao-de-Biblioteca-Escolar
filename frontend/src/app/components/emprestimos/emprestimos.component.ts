import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard-service';
import { Emprestimo } from '../../models/emprestimo.model';
import { Livro } from '../../models/livro.model';
import { Usuario } from '../../models/usuario.model';

@Component({
  selector: 'app-emprestimos',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './emprestimos.component.html',
  styleUrl: './emprestimos.component.css'
})
export class EmprestimosComponent implements OnInit {
  emprestimos: Emprestimo[] = [];
  emprestimosFiltrados: Emprestimo[] = [];

  todosLivros: Livro[] = [];
  livrosDisponiveis: Livro[] = [];
  usuariosAtivos: Usuario[] = [];
 
  termoBusca: string = '';
  statusFiltro: string = '';

  exibirModalNovo: boolean = false;
  novoEmprestimo = {
    livroId: null as number | null,
    usuarioId: null as number | null,
    dataEmprestimo: this.getHojeFormatado(),
    devolucaoPrevista: this.getDataFuturaFormatada(7)
  };

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados(): void {
    this.dashboardService.getEmprestimos().subscribe((dados) => {
      this.emprestimos = dados;
      this.aplicarFiltros();
    });

    this.carregarLivros();

    this.dashboardService.getUsuarios().subscribe((usuarios) => {
      this.usuariosAtivos = usuarios.filter(u => u.status === 'Ativo');
    });
  }

  carregarLivros(): void {
    this.dashboardService.getAcervo().subscribe((livros) => {
      this.todosLivros = livros;
      this.livrosDisponiveis = livros.filter(l => l.quantidadeDisponivel > 0);
    });
  }

  aplicarFiltros(): void {
    this.emprestimosFiltrados = this.emprestimos.filter(emp => {
      const atendeBusca = emp.livroTitulo.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          emp.usuarioNome.toLowerCase().includes(this.termoBusca.toLowerCase());

      const atendeStatus = this.statusFiltro ? emp.status === this.statusFiltro : true;

      return atendeBusca && atendeStatus;
    });
  }

  obterLocalizacaoLivro(livroId: number): string {
    const livro = this.todosLivros.find(l => l.id === livroId);
    if (livro && (livro.estante || livro.prateleira)) {
      return `${livro.estante || 'S/E'} - ${livro.prateleira || 'S/P'}`;
    }
    return 'Não informada';
  }

  obterLocalizacaoLivroSelecionado(): string | null {
    if (!this.novoEmprestimo.livroId) return null;
    return this.obterLocalizacaoLivro(Number(this.novoEmprestimo.livroId));
  }

  renovarEmprestimo(emprestimo: Emprestimo): void {
    const partes = emprestimo.devolucaoPrevista.split('/');
    const dataAtual = new Date(Number(partes[2]), Number(partes[1]) - 1, Number(partes[0]));
    dataAtual.setDate(dataAtual.getDate() + 7);

    emprestimo.devolucaoPrevista = this.formatarData(dataAtual);
    alert(`Empréstimo do livro "${emprestimo.livroTitulo}" renovado por mais 7 dias!`);
  }

  devolverLivro(emprestimo: Emprestimo): void {
    const confirmacao = confirm(`Confirmar a devolução do livro "${emprestimo.livroTitulo}"?`);
    if (confirmacao) {
      emprestimo.status = 'Devolvido';
      emprestimo.devolucaoReal = this.getHojeFormatado();
      
      this.dashboardService.incrementarEstoque(emprestimo.livroId);
      this.carregarLivros();
      this.aplicarFiltros();
    }
  }

  abrirModal(): void {
    this.exibirModalNovo = true;
  }

  fecharModal(): void {
    this.exibirModalNovo = false;
    this.resetarFormulario();
  }

  salvarEmprestimo(): void {
    const livro = this.livrosDisponiveis.find(l => l.id === Number(this.novoEmprestimo.livroId));
    const usuario = this.usuariosAtivos.find(u => u.id === Number(this.novoEmprestimo.usuarioId));

    if (livro && usuario) {
      const item: Emprestimo = {
        id: this.emprestimos.length + 1,
        livroId: livro.id,
        livroTitulo: livro.titulo,
        usuarioId: usuario.id,
        usuarioNome: usuario.nome,
        dataEmprestimo: this.formatarDataParaExibicao(this.novoEmprestimo.dataEmprestimo),
        devolucaoPrevista: this.formatarDataParaExibicao(this.novoEmprestimo.devolucaoPrevista),
        status: 'Em Andamento'
      };

      this.emprestimos.unshift(item);
      
      this.dashboardService.decrementarEstoque(livro.id);
      this.carregarLivros();

      this.aplicarFiltros();
      this.fecharModal();
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Em Andamento': return 'status-andamento';
      case 'Atrasado': return 'status-atrasado';
      case 'Devolvido': return 'status-devolvido';
      default: return '';
    }
  }

  private resetarFormulario(): void {
    this.novoEmprestimo = {
      livroId: null,
      usuarioId: null,
      dataEmprestimo: this.getHojeFormatado(),
      devolucaoPrevista: this.getDataFuturaFormatada(7)
    };
  }

  private getHojeFormatado(): string {
    return new Date().toISOString().split('T')[0];
  }

  private getDataFuturaFormatada(dias: number): string {
    const d = new Date();
    d.setDate(d.getDate() + dias);
    return d.toISOString().split('T')[0];
  }

  private formatarData(data: Date): string {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }

  private formatarDataParaExibicao(dataIso: string): string {
    if (!dataIso) return '';
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
  }
}