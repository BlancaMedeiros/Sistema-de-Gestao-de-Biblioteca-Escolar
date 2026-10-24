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
  novaSenha = '';
  mensagemSucesso = '';

  constructor(private usuarioService: UsuariosService, private loginService: LoginService, private cdr: ChangeDetectorRef) {}

  async ngOnInit() {
    this.usuario = await firstValueFrom(await this.loginService.getPerfilLogado())
    this.cdr.detectChanges()
  }

  async salvarPerfil(): Promise<void> {
    const response = await firstValueFrom(this.usuarioService.atualizarPerfil(this.usuario));
    if(response){
      this.mensagemSucesso = 'Perfil atualizado com sucesso!';
      this.usuario = response
      this.cdr.detectChanges();
      setTimeout(() => {
        this.mensagemSucesso = ''
        this.cdr.detectChanges();
      }, 3000);
    }
  }
}