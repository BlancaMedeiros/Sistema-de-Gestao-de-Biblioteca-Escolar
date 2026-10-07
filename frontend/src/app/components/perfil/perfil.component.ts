import { Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../services/usuarios.service';
import { LoginService } from '../../services/login.service';


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

  constructor(private usuarioService: UsuariosService, private loginService: LoginService) {}

  async ngOnInit() {
    // Busca os dados do usuário ID 8 (Bibliotecário) ou 1 (Aluno)
    const perfil = await this.loginService.getPerfilLogado()
    perfil.subscribe(dados => {
      this.usuario = dados;
    });
  }

  salvarPerfil(): void {
    this.usuarioService.atualizarPerfil(this.usuario);
    
    this.mensagemSucesso = 'Perfil atualizado com sucesso!';
    setTimeout(() => this.mensagemSucesso = '', 3000);
  }
}