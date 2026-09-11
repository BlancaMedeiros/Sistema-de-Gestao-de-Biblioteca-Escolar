import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DashboardService } from '../../services/dashboard-service';
import { Usuario } from '../../models/usuario.model';
import { Emprestimo } from '../../models/emprestimo.model';

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './usuarios.component.html',
  styleUrl: './usuarios.component.css'
})
export class UsuariosComponent implements OnInit {
  usuarios: Usuario[] = [];
  usuariosFiltrados: Usuario[] = [];
  
  termoBusca: string = '';
  tipoFiltro: string = '';
  statusFiltro: string = '';

  exibirModalNovo: boolean = false;
  exibirModalHistorico: boolean = false;
  
  usuarioSelecionado: Usuario | null = null;
  historicoUsuario: Emprestimo[] = [];

  novoUsuario: Partial<Usuario> = {
    nome: '',
    email: '',
    matricula: '',
    tipo: 'Aluno',
    status: 'Ativo'
  };

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    this.carregarUsuarios();
  }

  carregarUsuarios(): void {
    this.dashboardService.getUsuarios().subscribe((dados) => {
      this.usuarios = dados;
      this.aplicarFiltros();
    });
  }

  aplicarFiltros(): void {
    this.usuariosFiltrados = this.usuarios.filter(u => {
      const atendeBusca = u.nome.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          u.matricula.toLowerCase().includes(this.termoBusca.toLowerCase()) ||
                          u.email.toLowerCase().includes(this.termoBusca.toLowerCase());

      const atendeTipo = this.tipoFiltro ? u.tipo === this.tipoFiltro : true;
      const atendeStatus = this.statusFiltro ? u.status === this.statusFiltro : true;

      return atendeBusca && atendeTipo && atendeStatus;
    });
  }

  verHistorico(usuario: Usuario): void {
    this.usuarioSelecionado = usuario;
    this.dashboardService.getEmprestimos().subscribe((emprestimos) => {
      this.historicoUsuario = emprestimos.filter(e => e.usuarioId === usuario.id);
      this.exibirModalHistorico = true;
    });
  }

  fecharModalHistorico(): void {
    this.exibirModalHistorico = false;
    this.usuarioSelecionado = null;
    this.historicoUsuario = [];
  }

  abrirModalNovo(): void {
    this.exibirModalNovo = true;
  }

  fecharModalNovo(): void {
    this.exibirModalNovo = false;
    this.resetarFormulario();
  }

  salvarUsuario(): void {
    if (this.novoUsuario.nome && this.novoUsuario.email && this.novoUsuario.matricula) {
      const item: Usuario = {
        id: this.usuarios.length + 1,
        nome: this.novoUsuario.nome,
        email: this.novoUsuario.email,
        matricula: this.novoUsuario.matricula,
        tipo: this.novoUsuario.tipo || 'Aluno',
        status: (this.novoUsuario.status as 'Ativo' | 'Inativo') || 'Ativo',
        dataCadastro: this.getHojeFormatado()
      };
     
      this.dashboardService.adicionarUsuario(item);
      this.carregarUsuarios();
      this.fecharModalNovo();
    }
  }

  getStatusClass(status: string): string {
    return status === 'Ativo' ? 'status-ativo' : 'status-inativo';
  }

  getStatusEmprestimoClass(status: string): string {
    switch (status) {
      case 'Em Andamento': return 'status-andamento';
      case 'Atrasado': return 'status-atrasado';
      case 'Devolvido': return 'status-devolvido';
      default: return '';
    }
  }

  private resetarFormulario(): void {
    this.novoUsuario = {
      nome: '',
      email: '',
      matricula: '',
      tipo: 'Aluno',
      status: 'Ativo'
    };
  }

  private getHojeFormatado(): string {
    const data = new Date();
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();
    return `${dia}/${mes}/${ano}`;
  }
}