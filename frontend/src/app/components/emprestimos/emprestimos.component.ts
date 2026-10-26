import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard.service';
import { Emprestimo } from '../../models/emprestimo.model';
import { Livro } from '../../models/livro.model';
import { Usuario } from '../../models/usuario.model';
import { EmprestimoService } from '../../services/emprestimo.service';
import { UsuariosService } from '../../services/usuarios.service';
import { AcervoService } from '../../services/acervo.service';
import { firstValueFrom } from 'rxjs';

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
    usuarioId: null as number | null
  };

  constructor(private emprestimoService: EmprestimoService, private usuariosService: UsuariosService, private acervoService: AcervoService, private cdr: ChangeDetectorRef) {}

  ngOnInit(): void {
    this.carregarDados();
  }

  carregarDados(): void {
    this.emprestimoService.getEmprestimos().subscribe((dados) => {
      this.emprestimos = dados;
      this.aplicarFiltros();
    });

    this.carregarLivros();

    // Sem zone.js, cada resposta HTTP precisa redesenhar a tela; senão o modal
    // aberto antes de ela chegar fica com as listas vazias.
    this.usuariosService.getUsuarios(1, 100).subscribe((response) => {
      const usuarios = response.data
      this.usuariosAtivos = usuarios.filter(u => u.status === 'Ativo');
      this.cdr.detectChanges();
    });
  }

  carregarLivros(): void {
    this.acervoService.getAcervo().subscribe((livros) => {
      this.todosLivros = livros;
      this.livrosDisponiveis = livros.filter(l => l.quantidadeDisponivel > 0);
      this.cdr.detectChanges();
    });
  }

  aplicarFiltros(): void {
    this.emprestimosFiltrados = this.emprestimos.filter(emp => {
      const atendeBusca = emp.livroTitulo.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          emp.usuarioNome.toLowerCase().includes(this.termoBusca.toLowerCase());

      const atendeStatus = this.statusFiltro ? emp.status === this.statusFiltro : true;

      return atendeBusca && atendeStatus;
    });
    this.cdr.detectChanges();
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

  async renovarEmprestimo(emprestimo: Emprestimo): Promise<void> {
    const idempotencyKey = crypto.randomUUID();
    const resultado = await firstValueFrom(this.emprestimoService.renovar(emprestimo.id, idempotencyKey));
    if(resultado){
      this.carregarDados();
      alert(`Empréstimo do livro "${emprestimo.livroTitulo}" renovado por mais 7 dias!`);
    }
  }

  async devolverLivro(emprestimo: Emprestimo): Promise<void> {
    const confirmacao = confirm(`Confirmar a devolução do livro "${emprestimo.livroTitulo}"?`);
    if (confirmacao) {
      const idempotencyKey = crypto.randomUUID();
      const resultado = await firstValueFrom(this.emprestimoService.devolver(emprestimo.id, idempotencyKey));
      if(resultado){
        this.carregarDados();
      }
    }
  }

  abrirModal(): void {
    this.exibirModalNovo = true;
  }

  fecharModal(): void {
    this.exibirModalNovo = false;
    this.resetarFormulario();
    this.cdr.detectChanges();
  }

  

  async salvarEmprestimo(): Promise<void> {
    const livro = this.livrosDisponiveis.find(l => l.id === Number(this.novoEmprestimo.livroId));
    const usuario = this.usuariosAtivos.find(u => u.id === Number(this.novoEmprestimo.usuarioId));

    if (livro && usuario && livro.id) {
      // Datas, prazo de 7 dias e status são definidos pela API.
      const item = { livroId: livro.id, usuarioId: usuario.id };

      // this.emprestimos.unshift(item);
      const IdempotencyKey = crypto.randomUUID()
      const response  = await firstValueFrom(this.emprestimoService.adicionarEmprestismo(item, IdempotencyKey));
      if(response){
        this.carregarDados();
        this.fecharModal();
      }
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
      usuarioId: null
    };
  }

  private formatarData(data: Date): string {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
}