import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { DashboardService } from '../../services/dashboard.service';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UsuariosService } from '../../services/usuarios.service';
import { LoginService } from '../../services/login.service';
import { firstValueFrom } from 'rxjs';


@Component({
  selector: 'app-perfil',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './perfil.component.html',
  styleUrls: ['./perfil.component.css']
})
export class PerfilComponent implements OnInit {
  usuario: any;
  senhaAtual = '';
  novaSenha = '';
  mensagemSucesso = '';
  mensagemErro = '';

  constructor(private usuarioService: UsuariosService, private loginService: LoginService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    this.usuario = await firstValueFrom(await this.loginService.getPerfilLogado())
    this.cdr.detectChanges()
  }

  async salvarPerfil(): Promise<void> {
    this.mensagemErro = '';
    if (this.novaSenha && !this.senhaAtual) {
      this.mensagemErro = 'Informe a senha atual para trocar a senha.';
      this.cdr.detectChanges();
      return;
    }

    try {
      // Só os campos editáveis; nome, login, cargo, matrícula e contadores vêm da API.
      const response = await firstValueFrom(this.usuarioService.atualizarPerfil({
        email: this.usuario.email,
        telefone: this.usuario.telefone
      }));
      this.usuario = response;

      if (this.novaSenha) {
        await firstValueFrom(this.usuarioService.alterarSenha(this.senhaAtual, this.novaSenha));
        this.senhaAtual = '';
        this.novaSenha = '';
      }
    } catch (erro: any) {
      this.mensagemErro = erro?.error?.error?.message ?? 'Não foi possível salvar. Tente novamente.';
      this.cdr.detectChanges();
      return;
    }

    this.mensagemSucesso = 'Perfil atualizado com sucesso!';
    this.cdr.detectChanges();
    setTimeout(() => {
      this.mensagemSucesso = ''
      this.cdr.detectChanges();
    }, 3000);
  }
}