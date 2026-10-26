import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { LoginService } from '../../services/login.service';

@Component({
  selector: 'app-cabecalho',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './cabecalho.component.html',
  styleUrl: './cabecalho.component.css'
})
export class CabecalhoComponent {
  public menuAberto: boolean = false;

  // O nome exibido vem da sessão (login ou /me), não do armazenamento do navegador.
  constructor(public loginService: LoginService, private router: Router) {}

  // Abre e fecha a caixinha do menu
  public toggleMenu(): void {
    this.menuAberto = !this.menuAberto;
  }

  // Ação ao clicar em Logout: encerra a sessão também na API, senão o cookie continuaria válido
  public logout(): void {
    this.menuAberto = false;
    this.loginService.EfetuarLogout().subscribe(() => this.router.navigate(['/login']));
  }
}
