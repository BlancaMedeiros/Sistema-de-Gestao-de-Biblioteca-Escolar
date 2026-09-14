import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard-service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';


@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  usuario: any;
  novaSenha = '';
  mensagemSucesso = '';

  constructor(private dashboardService: DashboardService) {}

  ngOnInit(): void {
    // Busca os dados do usuário ID 8 (Bibliotecário) ou 1 (Aluno)
    this.dashboardService.getPerfilLogado(8).subscribe(dados => {
      this.usuario = dados;
    });
  }

  salvarPerfil(): void {
    this.dashboardService.atualizarPerfil(this.usuario);
    
    this.mensagemSucesso = 'Perfil atualizado com sucesso!';
    setTimeout(() => this.mensagemSucesso = '', 3000);
  }
}